"""Read-only, bounded Testnet JSON-RPC; no signer or configurable mainnet host."""
import json
from urllib.request import Request, urlopen


def lookup(tx_hash):
    for host in ('s.altnet.rippletest.net:51234', 'clio.altnet.rippletest.net:51234'):
        try:
            req = Request('https://' + host, data=json.dumps({'method': 'tx', 'params': [{'transaction': tx_hash, 'binary': False}]}).encode(), headers={'Content-Type': 'application/json'})
            with urlopen(req, timeout=5) as response:
                data = response.read(262145)
            if len(data) > 262144:
                raise ValueError('Oversized ledger response')
            result = json.loads(data)['result']
            if result.get('validated') is True:
                return result
        except (OSError, ValueError, KeyError):
            pass
    raise ValueError('Read-only Testnet lookup unavailable')


def verify_transactions(b, entries, lookup, add):
    cache = {}

    def tx(h):
        if h not in cache:
            r = lookup(h)
            if r.get('validated') is not True or r.get('meta', {}).get('TransactionResult') != 'tesSUCCESS':
                raise ValueError('Transaction is not validated tesSUCCESS')
            cache[h] = (r.get('tx_json', r), r['meta'], r['ledger_index'])
        return cache[h]

    def payment(h, sender, dest, amount, invoice, asset='XRP', ledger=None):
        t, m, n = tx(h)
        expected = amount if asset == 'XRP' else dict(currency=asset['currency'], issuer=asset['issuer'], value=amount)
        return t.get('TransactionType') == 'Payment' and t.get('Account') == sender and t.get('Destination') == dest and m.get('delivered_amount') == expected and t.get('InvoiceID', '').upper() == invoice.upper() and not (int(t.get('Flags', 0)) & 0x20000) and not any(k in t for k in ('SendMax', 'Paths', 'DeliverMin')) and (asset == 'XRP' or t.get('Amount', t.get('DeliverMax')) == expected) and (ledger in (None, '') or n == ledger)

    def create_ok(t, terms):
        return t.get('TransactionType') == 'EscrowCreate' and t.get('Account') == terms['payer'] and t.get('Destination') == terms['payTo'] and t.get('Amount') == terms['amount'] and t.get('Condition') == terms['condition'] and t.get('CancelAfter') == terms['cancelAfter'] and not any(k in t for k in ('FinishAfter', 'InvoiceID', 'DestinationTag', 'SourceTag')) and not t.get('Flags') and t.get('Memos') == [{'Memo': {'MemoType': b'researchagent/escrow-v1'.hex().upper(), 'MemoData': __import__('researchagent.verify', fromlist=['canonical']).canonical(terms).encode().hex().upper()}}] and isinstance(t.get('Sequence'), int) and t['Sequence'] > 0 and isinstance(t.get('LastLedgerSequence'), int) and 0 < int(t.get('Fee', 0)) <= 2000

    def check(name, fn):
        try:
            add('testnet ' + name, bool(fn()), 'Read-only s.altnet / Clio Testnet check')
        except (OSError, ValueError, KeyError, TypeError, IndexError, StopIteration):
            add('testnet ' + name, False, 'Ledger lookup or binding unavailable')

    for p in b['payments']:
        if 'SIMULATED' in p['label']:
            continue
        name = p['intentId']
        terms = p.get('escrowTerms')
        if terms:
            def create(p=p, terms=terms):
                t, _, _ = tx(p['escrowCreateHash'])
                return create_ok(t, terms) and t.get('Sequence') == p['escrowCreateSequence']
            check('escrow-create ' + name, create)
            def terminal(p=p, terms=terms):
                t, _, n = tx(p['txHash'])
                finish = p['escrowState'] == 'RELEASED'
                return p['escrowState'] in ('RELEASED', 'CANCELLED') and t.get('TransactionType') == ('EscrowFinish' if finish else 'EscrowCancel') and t.get('Owner') == terms['payer'] and t.get('OfferSequence') == p['escrowCreateSequence'] and (not finish or t.get('Condition') == terms['condition']) and p['amountDrops'] == (terms['amount'] if finish else '0') and (p['ledgerIndex'] == '' or n == p['ledgerIndex'])
            check(('escrow-finish ' if p['escrowState'] == 'RELEASED' else 'escrow-cancel ') + name, terminal)
        else:
            check('payment ' + name, lambda p=p: payment(p['txHash'], p['payer'], p['payee'], p['amountDrops'], p['invoiceId'], p.get('asset', 'XRP'), p['ledgerIndex']))
        if p.get('refundTxHash'):
            asset = p.get('asset', 'XRP')
            amount = str(int(p['refundAmountMinor']) * 1000) if asset == 'XRP' else format(int(p['refundAmountMinor']) / 100, '.2f')
            check('refund ' + name, lambda p=p, amount=amount, asset=asset: payment(p['refundTxHash'], p['payee'], p['payer'], amount, p['txHash'], asset))
    for e in entries:
        if e['kind'] not in ('ESCROW_CREATE', 'ESCROW_FINISH', 'ESCROW_CANCEL'):
            continue
        d = e['data']
        def event(e=e, d=d):
            t, _, n = tx(d['txHash'])
            if n != d['ledgerIndex']:
                return False
            if e['kind'] == 'ESCROW_CREATE':
                import hashlib
                invoice = bytes.fromhex(t['Memos'][0]['Memo']['MemoData']).decode()
                terms = json.loads(invoice)
                return create_ok(t, terms) and hashlib.sha256(invoice.encode()).hexdigest().upper() == d['invoiceHash'] and t.get('Account') == d['owner'] and t.get('Sequence') == d['createSequence'] and t.get('Amount') == d['amountDrops'] and t.get('Destination') == d['payTo'] and t.get('CancelAfter') == d['cancelAfter']
            return t.get('TransactionType') == ('EscrowFinish' if e['kind'] == 'ESCROW_FINISH' else 'EscrowCancel') and t.get('Owner') == d['owner'] and t.get('OfferSequence') == d['createSequence']
        check(e['kind'].lower().replace('_', '-') + ' ' + e['intentId'], event)
        if e['kind'] == 'ESCROW_FINISH':
            def proof(e=e, d=d):
                if not event(e, d):
                    return False
                if d.get('proofOk') is True:
                    return True
                r = next(r for r in entries if r['kind'] == 'refund' and r['intentId'] == e['intentId'] and r['data']['originalTxHash'] == d['txHash'])
                c = next(c['data'] for c in entries if c['kind'] == 'ESCROW_CREATE' and c['intentId'] == e['intentId'])
                return d.get('proofOk') is False and payment(r['data']['txHash'], c['payTo'], d['owner'], c['amountDrops'], d['txHash'])
            check('key-reveal-proof ' + e['intentId'], proof)
