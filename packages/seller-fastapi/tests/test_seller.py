import asyncio
import json
import os
from types import SimpleNamespace
import pytest
import httpx
from fastapi import FastAPI
from xrpl.wallet import Wallet
from xrpl.asyncio.clients import AsyncJsonRpcClient
from xrpl.asyncio.wallet import generate_faucet_wallet
from xrpl.asyncio.transaction import autofill, submit_and_wait
from xrpl.models.requests import Tx
from xrpl.models.transactions import EscrowCreate, Memo
from xrpl.transaction import sign
from researchagent_seller_fastapi import Seller, seal, open_envelope, condition_for, check_create, commitment

def test_key_and_ciphertext_tampering():
    key, envelope = seal(b"paid secret")
    condition = condition_for(key)
    finish = {"Condition": condition, "Fulfillment": "A0228020" + key.hex().upper()}
    assert open_envelope(envelope, finish, condition) == b"paid secret"
    assert "paid secret" not in json.dumps(envelope)
    for field, value in (("tag", "00"*16), ("plaintextHash", "00"*32)):
        with pytest.raises(Exception):
            open_envelope({**envelope, field: value}, finish, condition)
    with pytest.raises(ValueError):
        open_envelope(envelope, {**finish, "Fulfillment": "A0228020" + "00"*32}, condition)

def test_fastapi_challenge_and_term_binding(tmp_path):
    class Client:
        async def request(self, req):
            return SimpleNamespace(result={"info": {"network_id": 1}} if type(req).__name__ == "ServerInfo" else {"ledger": {"close_time": 100}})
    seller = Seller(wallet=Wallet.create(), client=Client(), db_path=str(tmp_path/"seller.db"), resource_url="http://localhost/article", content=lambda _: b"paid secret")
    async def run():
        app = FastAPI(); app.add_api_route("/article", seller.endpoint, methods=["GET"])
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
            response = await client.get("/article", params={"buyer": Wallet.create().classic_address, "intent": "one"})
            assert response.status_code == 402
            assert "paid secret" not in response.text
            offer = response.json(); req = offer["accepts"][0]; extra = req["extra"]
            tx = {"TransactionType": "EscrowCreate", "Account": extra["buyer"], "Destination": req["payTo"], "Amount": req["amount"], "Condition": extra["condition"], "CancelAfter": extra["cancelAfter"], "Sequence": 1, "Memos": [{"Memo": {"MemoData": commitment(offer)}}]}
            check_create(tx, offer)
            for patch in ({"Amount": "1"}, {"NetworkID": 0}, {"FinishAfter": 110}, {"DestinationTag": 1}, {"Memos": []}):
                with pytest.raises(ValueError): check_create({**tx, **patch}, offer)
    try: asyncio.run(run())
    finally: seller.close()

@pytest.mark.skipif(os.environ.get("XRPL_KEY_REVEAL_TESTNET") != "1", reason="Testnet opt-in")
def test_testnet_purchase(tmp_path):
    async def run():
        client = AsyncJsonRpcClient("https://s.altnet.rippletest.net:51234")
        buyer = await generate_faucet_wallet(client)
        wallet = await generate_faucet_wallet(client)
        seller = Seller(wallet=wallet, client=client, db_path=str(tmp_path/"live.db"), resource_url="http://localhost/article", content=lambda _: b"Synthetic integration article.")
        try:
            challenge = await seller.handle(buyer.classic_address, "once")
            assert challenge.status_code == 402
            offer = json.loads(challenge.body); req = offer["accepts"][0]; extra = req["extra"]
            prepared = await autofill(EscrowCreate(account=buyer.classic_address, destination=req["payTo"], amount=req["amount"], condition=extra["condition"], cancel_after=extra["cancelAfter"], memos=[Memo(memo_data=commitment(offer))]), client)
            assert int(prepared.fee) <= 1000
            signed = sign(prepared, buyer); print("Testnet create", signed.get_hash())
            await submit_and_wait(signed.blob(), client)
            import base64
            header = base64.b64encode(json.dumps({"x402Version": 2, "accepted": req, "payload": {"signedTxBlob": signed.blob()}}).encode()).decode()
            paid = await seller.handle(buyer.classic_address, "once", header)
            assert paid.status_code == 200
            result = json.loads(paid.body); print("Testnet finish", result["finishHash"])
            finish = (await client.request(Tx(transaction=result["finishHash"]))).result
            assert finish["validated"] is True and finish["meta"]["TransactionResult"] == "tesSUCCESS"
            assert open_envelope(offer["extensions"]["keyReveal"], finish.get("tx_json", finish), extra["condition"]) == b"Synthetic integration article."
        finally: seller.close()
    asyncio.run(run())

def test_restart_recovers_validated_finish_without_signing_or_submitting_again(tmp_path, monkeypatch):
    import base64
    import researchagent_seller_fastapi as protocol
    from xrpl.models.transactions import EscrowFinish
    from xrpl.core.binarycodec import decode
    wallet, buyer = Wallet.create(), Wallet.create()
    ledger = {}
    counts = {"autofill": 0, "submit": 0}
    offer = None
    create = None
    class Client:
        async def request(self, request):
            kind = type(request).__name__
            if kind == "ServerInfo": result = {"info": {"network_id": 1}}
            elif kind == "Ledger": result = {"ledger": {"close_time": 100}}
            elif kind == "LedgerEntry": result = {"node": next(entry["tx_json"] for entry in ledger.values() if entry["tx_json"].get("TransactionType") == "EscrowCreate" and entry["tx_json"]["Sequence"] == request.escrow.seq)}
            else:
                if request.transaction not in ledger: raise ValueError("transaction not found")
                result = ledger[request.transaction]
            return SimpleNamespace(result=result)
    async def autofill_finish(tx, _client):
        counts["autofill"] += 1
        return EscrowFinish.from_dict({**tx.to_dict(), "fee": "20", "sequence": 1, "last_ledger_sequence": 50})
    async def uncertain_submit(blob, _client):
        counts["submit"] += 1
        decoded = decode(blob)
        tx_hash = __import__("hashlib").sha512(bytes.fromhex("54584E00" + blob)).digest()[:32].hex().upper()
        ledger[tx_hash] = {"validated": True, "meta": {"TransactionResult": "tesSUCCESS"}, "tx_json": decoded}
        raise TimeoutError("response lost after validation")
    monkeypatch.setattr(protocol, "autofill", autofill_finish)
    monkeypatch.setattr(protocol, "submit_and_wait", uncertain_submit)
    db_path = str(tmp_path/"recover.db")
    client = Client()
    def make(): return Seller(wallet=wallet, client=client, db_path=db_path, resource_url="http://localhost/article", content=lambda _: b"private article")
    async def run():
        nonlocal offer, create
        seller = make()
        try:
            offer = json.loads((await seller.handle(buyer.classic_address, "restart")).body)
            terms = offer["accepts"][0]; extra = terms["extra"]
            tx = EscrowCreate(account=buyer.classic_address, destination=terms["payTo"], amount=terms["amount"], condition=extra["condition"], cancel_after=extra["cancelAfter"], sequence=1, fee="12", last_ledger_sequence=50, memos=[Memo(memo_data=commitment(offer))])
            signed = sign(tx, buyer); create = decode(signed.blob())
            ledger[signed.get_hash()] = {"hash": signed.get_hash(), "validated": True, "meta": {"TransactionResult": "tesSUCCESS"}, "tx_json": create}
            header = base64.b64encode(json.dumps({"x402Version": 2, "accepted": terms, "payload": {"signedTxBlob": signed.blob()}}).encode()).decode()
            assert (await seller.handle(buyer.classic_address, "restart", header)).status_code == 400
            other = json.loads((await seller.handle(buyer.classic_address, "other")).body)
            other_terms = other["accepts"][0]; other_extra = other_terms["extra"]
            other_tx = EscrowCreate(account=buyer.classic_address, destination=other_terms["payTo"], amount=other_terms["amount"], condition=other_extra["condition"], cancel_after=other_extra["cancelAfter"], sequence=2, fee="12", last_ledger_sequence=50, memos=[Memo(memo_data=commitment(other))])
            other_signed = sign(other_tx, buyer)
            ledger[other_signed.get_hash()] = {"hash": other_signed.get_hash(), "validated": True, "meta": {"TransactionResult": "tesSUCCESS"}, "tx_json": decode(other_signed.blob())}
            other_header = base64.b64encode(json.dumps({"x402Version": 2, "accepted": other_terms, "payload": {"signedTxBlob": other_signed.blob()}}).encode()).decode()
            assert (await seller.handle(buyer.classic_address, "other", other_header)).status_code == 400
            assert counts == {"autofill": 1, "submit": 1}
        finally: seller.close()
        recovered = make()
        try:
            response = await recovered.handle(buyer.classic_address, "restart", header)
            assert response.status_code == 200
            result = json.loads(response.body)
            assert counts == {"autofill": 1, "submit": 1}
            assert "private article" not in response.body.decode()
            final = ledger[result["finishHash"]]["tx_json"]
            assert open_envelope(offer["extensions"]["keyReveal"], final, extra["condition"]) == b"private article"
            assert json.loads((await recovered.handle(buyer.classic_address, "restart", header)).body) == result
            assert counts == {"autofill": 1, "submit": 1}
        finally: recovered.close()
    asyncio.run(run())

def test_near_expiry_refuses_new_finish_before_key_reveal(tmp_path, monkeypatch):
    import base64
    import researchagent_seller_fastapi as protocol
    from xrpl.core.binarycodec import decode
    from xrpl.models.transactions import EscrowFinish
    original_sign = protocol.sign
    for during_autofill in (False, True):
        wallet, buyer = Wallet.create(), Wallet.create()
        now, create, tx_hash, calls, signatures = 100, None, None, 0, 0
        class Client:
            async def request(self, request):
                kind = type(request).__name__
                if kind == "ServerInfo": result = {"info": {"network_id": 1}}
                elif kind == "Ledger": result = {"ledger": {"close_time": now}}
                elif kind == "LedgerEntry": result = {"node": create}
                else: result = {"hash": tx_hash, "validated": True, "meta": {"TransactionResult": "tesSUCCESS"}, "tx_json": create}
                return SimpleNamespace(result=result)
        async def late_autofill(tx, _client):
            nonlocal calls, now
            calls += 1; now = 159
            return EscrowFinish.from_dict({**tx.to_dict(), "fee": "20", "sequence": 1, "last_ledger_sequence": 50})
        def count_signature(*args):
            nonlocal signatures
            signatures += 1
            return original_sign(*args)
        monkeypatch.setattr(protocol, "autofill", late_autofill)
        monkeypatch.setattr(protocol, "sign", count_signature)
        seller = Seller(wallet=wallet, client=Client(), db_path=str(tmp_path/(str(during_autofill)+".db")), resource_url="http://localhost/article", content=lambda _: b"paid article")
        async def run():
            nonlocal now, create, tx_hash
            offer = json.loads((await seller.handle(buyer.classic_address, "late")).body)
            terms = offer["accepts"][0]; extra = terms["extra"]
            tx = EscrowCreate(account=buyer.classic_address, destination=terms["payTo"], amount=terms["amount"], condition=extra["condition"], cancel_after=extra["cancelAfter"], sequence=1, fee="12", memos=[Memo(memo_data=commitment(offer))])
            signed = sign(tx, buyer); create = decode(signed.blob()); tx_hash = signed.get_hash()
            if not during_autofill: now = extra["cancelAfter"]-1
            header = base64.b64encode(json.dumps({"x402Version": 2, "accepted": terms, "payload": {"signedTxBlob": signed.blob()}}).encode()).decode()
            assert (await seller.handle(buyer.classic_address, "late", header)).status_code == 400
            assert calls == (1 if during_autofill else 0)
            assert signatures == 0
        try: asyncio.run(run())
        finally: seller.close()
