"""Testnet-only x402 key-reveal seller. One process owns each journal and wallet."""
from __future__ import annotations
import asyncio
import base64
import hashlib
import json
import os
import re
import sqlite3
import uuid
from typing import Any, Callable, TypedDict
from urllib.parse import urlparse
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import Request
from fastapi.responses import JSONResponse
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.asyncio.transaction import autofill, submit_and_wait
from xrpl.core.binarycodec import decode
from xrpl.models.requests import ServerInfo, Ledger, Tx, LedgerEntry
from xrpl.models.requests.ledger_entry import Escrow
from xrpl.models.transactions import EscrowFinish
from xrpl.transaction import sign
from xrpl.wallet import Wallet

class Envelope(TypedDict):
    ciphertext: str
    iv: str
    tag: str
    plaintextHash: str

def require(ok: bool) -> None:
    if not ok:
        raise ValueError("Escrow terms or validated transaction rejected")

def canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def commitment(offer: dict[str, Any]) -> str:
    return hashlib.sha256(canonical(offer).encode()).hexdigest().upper()

def condition_for(key: bytes) -> str:
    return "A0258020" + hashlib.sha256(key).hexdigest().upper() + "810120"

def seal(content: bytes) -> tuple[bytes, Envelope]:
    key, iv = os.urandom(32), os.urandom(12)
    encrypted = AESGCM(key).encrypt(iv, content, None)
    return key, {"ciphertext": encrypted[:-16].hex().upper(), "iv": iv.hex().upper(),
                 "tag": encrypted[-16:].hex().upper(), "plaintextHash": hashlib.sha256(content).hexdigest().upper()}

def open_envelope(envelope: Envelope, finish: dict[str, Any], condition: str) -> bytes:
    require(bool(re.fullmatch(r"A0228020[A-F0-9]{64}", finish["Fulfillment"])))
    key = bytes.fromhex(finish["Fulfillment"][8:])
    require(condition_for(key) == condition == finish["Condition"])
    plain = AESGCM(key).decrypt(bytes.fromhex(envelope["iv"]), bytes.fromhex(envelope["ciphertext"] + envelope["tag"]), None)
    require(hashlib.sha256(plain).hexdigest().upper() == envelope["plaintextHash"])
    return plain

def check_create(tx: dict[str, Any], offer: dict[str, Any]) -> None:
    terms = offer["accepts"][0]
    extra = terms["extra"]
    expected = {"TransactionType": "EscrowCreate", "Account": extra["buyer"], "Destination": terms["payTo"],
                "Amount": terms["amount"], "Condition": extra["condition"], "CancelAfter": extra["cancelAfter"],
                "Memos": [{"Memo": {"MemoData": commitment(offer)}}]}
    require(all(tx.get(k) == v for k, v in expected.items()))
    require(all(k not in tx for k in ("FinishAfter", "DestinationTag", "SourceTag", "TicketSequence", "NetworkID")))
    require(tx.get("Flags", 0) in (0, 0x80000000))
    require(isinstance(tx.get("Sequence"), int) and tx["Sequence"] > 0)

def validated(result: dict[str, Any]) -> dict[str, Any]:
    require(result.get("validated") is True and result["meta"]["TransactionResult"] == "tesSUCCESS")
    return result.get("tx_json", result)

class Seller:
    def __init__(self, *, wallet: Wallet, db_path: str, resource_url: str,
                 content: Callable[[str], bytes], amount_drops: str = "1000",
                 client: AsyncJsonRpcClient | None = None, timeout_seconds: int = 60,
                 max_offers: int = 1000, withhold: bool = False):
        require(bool(re.fullmatch(r"[1-9][0-9]*", amount_drops)) and int(amount_drops) <= 1_000_000)
        require(24 <= timeout_seconds <= 300)
        url = urlparse(resource_url)
        require(url.scheme == "https" or (url.scheme == "http" and url.hostname in ("127.0.0.1", "localhost")))
        self.wallet, self.resource_url, self.content = wallet, resource_url, content
        self.amount, self.timeout, self.max_offers, self.withhold = amount_drops, timeout_seconds, max_offers, withhold
        self.client = client or AsyncJsonRpcClient("https://s.altnet.rippletest.net:51234")
        self.db = sqlite3.connect(db_path)
        if db_path != ":memory:":
            os.chmod(db_path, 0o600)
        self.db.execute("PRAGMA journal_mode=DELETE")
        self.db.execute("CREATE TABLE IF NOT EXISTS offers (id TEXT PRIMARY KEY, state TEXT NOT NULL)")
        self.lock = asyncio.Lock()

    def close(self) -> None:
        self.db.close()

    def _read(self, key: str) -> dict[str, Any] | None:
        row = self.db.execute("SELECT state FROM offers WHERE id=?", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def _save(self, key: str, state: dict[str, Any]) -> None:
        self.db.execute("INSERT OR REPLACE INTO offers VALUES (?,?)", (key, canonical(state)))
        self.db.commit()

    async def handle(self, buyer: str, intent: str, payment_signature: str | None = None) -> JSONResponse:
        async with self.lock:
            try:
                info = await self.client.request(ServerInfo())
                require(info.result["info"]["network_id"] == 1)
                require(bool(re.fullmatch(r"r[1-9A-HJ-NP-Za-km-z]{24,34}", buyer)))
                require(bool(re.fullmatch(r"[A-Za-z0-9_-]{1,128}", intent)))
                identity = buyer + ":" + intent
                state = self._read(identity)
                if state is None:
                    require(payment_signature is None)
                    require(self.db.execute("SELECT count(*) FROM offers").fetchone()[0] < self.max_offers)
                    now = (await self.client.request(Ledger(ledger_index="validated"))).result["ledger"]["close_time"]
                    key, envelope = seal(self.content(intent))
                    offer = {"x402Version": 2, "resource": {"url": self.resource_url}, "accepts": [{
                        "scheme": "key-reveal-escrow", "network": "xrpl:1", "asset": "XRP", "amount": self.amount,
                        "payTo": self.wallet.classic_address, "maxTimeoutSeconds": self.timeout, "extra": {
                            "invoiceId": str(uuid.uuid4()), "buyer": buyer, "condition": condition_for(key), "cancelAfter": now + self.timeout}}],
                             "extensions": {"keyReveal": envelope}}
                    state = {"key": key.hex().upper(), "offer": offer}
                    self._save(identity, state)
                offer = state["offer"]
                headers = {"Cache-Control": "no-store"}
                if payment_signature is None:
                    headers["PAYMENT-REQUIRED"] = base64.b64encode(canonical(offer).encode()).decode()
                    return JSONResponse(offer, status_code=402, headers=headers)
                require(len(payment_signature) <= 32768)
                payment = json.loads(base64.b64decode(payment_signature, validate=True))
                require(payment["x402Version"] == 2 and payment["accepted"] == offer["accepts"][0])
                blob = payment["payload"]["signedTxBlob"]
                tx = decode(blob)
                check_create(tx, offer)
                tx_hash = hashlib.sha512(bytes.fromhex("54584E00" + blob)).digest()[:32].hex().upper()
                require(state.get("createHash", tx_hash) == tx_hash)
                create = (await self.client.request(Tx(transaction=tx_hash))).result
                require(create["hash"].upper() == tx_hash)
                check_create(validated(create), offer)
                state["createHash"] = tx_hash
                self._save(identity, state)
                if self.withhold:
                    return JSONResponse({"status": "key withheld; cancel after expiry", "createHash": tx_hash}, status_code=202, headers=headers)
                if "finish" not in state:
                    # Do not reuse the sequence owned by an uncertain finish.
                    require(self.db.execute("SELECT id FROM offers WHERE id<>? AND json_extract(state,'$.finish') IS NOT NULL AND COALESCE(json_extract(state,'$.done'),0)=0 LIMIT 1", (identity,)).fetchone() is None)
                    node = (await self.client.request(LedgerEntry(ledger_index="validated", escrow=Escrow(owner=buyer, seq=tx["Sequence"])))).result["node"]
                    require(all(node[k] == tx[k] for k in ("Account", "Destination", "Amount", "Condition", "CancelAfter")))
                    async def headroom() -> None:
                        now = (await self.client.request(Ledger(ledger_index="validated"))).result["ledger"]["close_time"]
                        require(node["CancelAfter"] - now > 8)
                    await headroom()
                    prepared = await autofill(EscrowFinish(account=self.wallet.classic_address, owner=buyer,
                        offer_sequence=tx["Sequence"], condition=node["Condition"], fulfillment="A0228020" + state["key"]), self.client)
                    require(int(prepared.fee) <= 1000)
                    await headroom()
                    signed = sign(prepared, self.wallet)
                    state["finish"] = {"blob": signed.blob(), "hash": signed.get_hash()}
                    self._save(identity, state)
                if not state.get("done"):
                    # Reuse the persisted signed blob after uncertainty. Never simulate the key.
                    try:
                        final = (await self.client.request(Tx(transaction=state["finish"]["hash"]))).result
                    except Exception:
                        final = {}
                    if final.get("validated") is not True:
                        final = (await submit_and_wait(state["finish"]["blob"], self.client)).result
                    finish = validated(final)
                    require(finish["TransactionType"] == "EscrowFinish" and finish["Owner"] == buyer and finish["OfferSequence"] == tx["Sequence"])
                    require(finish["Condition"] == tx["Condition"] and finish["Fulfillment"] == "A0228020" + state["key"])
                    state["done"] = True
                    self._save(identity, state)
                result = {"finishHash": state["finish"]["hash"], "createHash": tx_hash}
                headers["PAYMENT-RESPONSE"] = base64.b64encode(canonical({"success": True, "transaction": result["finishHash"], "network": "xrpl:1", "payer": buyer}).encode()).decode()
                return JSONResponse(result, headers=headers)
            except Exception:
                return JSONResponse({"error": "Escrow offer or validated transaction rejected; retry original intent and blob only"}, status_code=400, headers={"Cache-Control": "no-store"})

    async def endpoint(self, request: Request) -> JSONResponse:
        return await self.handle(request.query_params.get("buyer", ""), request.query_params.get("intent", ""), request.headers.get("PAYMENT-SIGNATURE"))
