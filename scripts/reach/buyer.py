"""Independent buyer: installed third-party Python libraries and HTTP only. No repository imports."""
import asyncio
import base64
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.asyncio.transaction import autofill, submit_and_wait
from xrpl.models.requests import ServerInfo, Ledger, Tx, AccountInfo
from xrpl.models.transactions import EscrowCreate, EscrowCancel, Memo
from xrpl.transaction import sign
from xrpl.wallet import Wallet

def check(ok):
    if not ok:
        raise ValueError("Independent buyer verification failed")

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

async def main():
    config = json.loads(Path(sys.argv[1]).read_text())
    wallet = Wallet.from_seed(config["buyerSeed"])
    client = AsyncJsonRpcClient("https://s.altnet.rippletest.net:51234")
    check((await client.request(ServerInfo())).result["info"]["network_id"] == 1)
    receipts = []
    def record(kind, tx_hash):
        receipts.append({"kind": kind, "hash": tx_hash})
        Path(config["evidence"]).write_text(json.dumps({"kind": "real-testnet-python-httpx-to-installed-seller-hono", "complete": False, "transactions": receipts}, indent=2))
        print(kind + ": " + tx_hash, flush=True)
    async def submit(tx, kind):
        prepared = await autofill(tx, client)
        check(0 < int(prepared.fee) <= 1000)
        signed = sign(prepared, wallet)
        private = Path(config["directory"]) / (kind.replace(" ", "-") + ".signed.json")
        # Refuse replacement on rerun; retain the exact blob before any submission.
        with os.fdopen(os.open(private, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as journal:
            json.dump({"kind": kind, "hash": signed.get_hash(), "signedTxBlob": signed.blob()}, journal)
            journal.flush()
            os.fsync(journal.fileno())
        record(kind, signed.get_hash())  # Record before submitting; an interrupted result is pending.
        result = (await submit_and_wait(signed.blob(), client)).result
        check(result.get("validated") is True and result["meta"]["TransactionResult"] == "tesSUCCESS")
        return signed, result.get("tx_json", result)
    async with httpx.AsyncClient(timeout=90) as http:
        async def buy(path, kind):
            url = config["url"] + path
            params = {"buyer": wallet.classic_address, "intent": "acceptance-" + kind}
            challenge = await http.get(url, params=params)
            check(challenge.status_code == 402)
            offer = json.loads(base64.b64decode(challenge.headers["PAYMENT-REQUIRED"]))
            check(offer == challenge.json() and offer["resource"]["url"] == url)
            terms = offer["accepts"][0]; extra = terms["extra"]
            check(terms["scheme"] == "key-reveal-escrow" and terms["network"] == "xrpl:1" and terms["asset"] == "XRP")
            check(terms["payTo"] == config["sellerAddress"] and terms["amount"] == "1000" and extra["buyer"] == wallet.classic_address)
            now = (await client.request(Ledger(ledger_index="validated"))).result["ledger"]["close_time"]
            check(now + 8 < extra["cancelAfter"] <= now + 65)
            check(bool(re.fullmatch(r"A0258020[A-F0-9]{64}810120", extra["condition"])))
            digest = hashlib.sha256(canonical(offer).encode()).hexdigest().upper()
            signed, create = await submit(EscrowCreate(account=wallet.classic_address, destination=terms["payTo"], amount=terms["amount"], condition=extra["condition"], cancel_after=extra["cancelAfter"], memos=[Memo(memo_data=digest)]), kind + " create")
            payload = {"x402Version": 2, "accepted": terms, "payload": {"signedTxBlob": signed.blob()}}
            headers = {"PAYMENT-SIGNATURE": base64.b64encode(canonical(payload).encode()).decode()}
            response = await http.get(url, params=params, headers=headers)
            check(response.status_code == (202 if kind == "withhold" else 200))
            check("Synthetic package acceptance article" not in response.text)
            check(response.json()["createHash"] == signed.get_hash())
            return offer, create, response.json(), (url, params, headers)
        withheld = await buy("/withhold", "withhold")
        offer, create, result, retry = await buy("/article", "deliver")
        record("deliver finish", result["finishHash"])
        finish = (await client.request(Tx(transaction=result["finishHash"]))).result
        check(finish["hash"].upper() == result["finishHash"].upper())
        check(finish["validated"] is True and finish["meta"]["TransactionResult"] == "tesSUCCESS")
        tx = finish.get("tx_json", finish)
        check(tx["TransactionType"] == "EscrowFinish" and tx["Owner"] == wallet.classic_address and tx["OfferSequence"] == create["Sequence"])
        check(bool(re.fullmatch(r"A0228020[A-F0-9]{64}", tx["Fulfillment"])))
        key = bytes.fromhex(tx["Fulfillment"][8:])
        condition = "A0258020" + hashlib.sha256(key).hexdigest().upper() + "810120"
        check(condition == tx["Condition"] == offer["accepts"][0]["extra"]["condition"])
        encrypted = offer["extensions"]["keyReveal"]
        plaintext = AESGCM(key).decrypt(bytes.fromhex(encrypted["iv"]), bytes.fromhex(encrypted["ciphertext"] + encrypted["tag"]), None)
        check(hashlib.sha256(plaintext).hexdigest().upper() == encrypted["plaintextHash"])
        check(plaintext == b"Synthetic package acceptance article: key revealed on XRPL Testnet.")
        url, params, headers = retry
        replay = await http.get(url, params=params, headers=headers)
        check(replay.status_code == 200 and replay.json() == result)
        deadline = time.monotonic() + 100
        while (await client.request(Ledger(ledger_index="validated"))).result["ledger"]["close_time"] <= withheld[0]["accepts"][0]["extra"]["cancelAfter"]:
            check(time.monotonic() < deadline)
            await asyncio.sleep(1)
        async def balance():
            return int((await client.request(AccountInfo(account=wallet.classic_address, ledger_index="validated"))).result["account_data"]["Balance"])
        before = await balance()
        _, cancel = await submit(EscrowCancel(account=wallet.classic_address, owner=wallet.classic_address, offer_sequence=withheld[1]["Sequence"]), "withhold cancel")
        check(await balance() - before + int(cancel["Fee"]) == 1000)
        Path(config["evidence"]).write_text(json.dumps({"kind": "real-testnet-python-httpx-to-installed-seller-hono", "complete": True, "transactions": receipts, "plaintextHashVerified": True, "ledgerKeyVerified": True, "retrySameFinish": True, "cancelPrincipalDrops": "1000", "networkFeesRefunded": False}, indent=2))
        print("RESULT PASS: independent Python buyer; installed Hono seller; key, ciphertext, replay and expiry refund verified", flush=True)
asyncio.run(main())
