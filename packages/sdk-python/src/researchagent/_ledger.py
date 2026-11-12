"""Read-only, bounded Testnet JSON-RPC; no signer or configurable mainnet host."""
import json
import hashlib
import re
from decimal import Decimal
from urllib.request import Request, urlopen
from ._holdback import key_terms, create_ok as holdback_create_ok, terminal_ok as holdback_terminal_ok


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
        return t.get('TransactionType') == 'Payment' and t.get('Account') == sender and t.get('Destination') == dest and matches_amount(m.get('delivered_amount'), amount, asset) and t.get('InvoiceID', '').upper() == invoice.upper() and not (int(t.get('Flags', 0)) & 0x20000) and not any(k in t for k in ('SendMax', 'Paths', 'DeliverMin')) and (asset == 'XRP' or matches_amount(t.get('Amount', t.get('DeliverMax')), amount, asset)) and (ledger in (None, '') or n == ledger)

    def matches_amount(actual, value, asset):
        if asset == 'XRP':
            return actual == value
        return isinstance(actual, dict) and actual.get('currency') == asset['currency'] and actual.get('issuer') == asset['issuer'] and Decimal(actual['value']) == Decimal(value)

    def create_ok(t, terms):
        if terms.get('holdback'):
            return holdback_create_ok(t, terms)
        return t.get('TransactionType') == 'EscrowCreate' and t.get('Account') == terms['payer'] and t.get('Destination') == terms['payTo'] and matches_amount(t.get('Amount'), terms['amount'], terms['asset']) and t.get('Condition') == terms['condition'] and t.get('CancelAfter') == terms['cancelAfter'] and not any(k in t for k in ('FinishAfter', 'InvoiceID', 'DestinationTag', 'SourceTag')) and not t.get('Flags') and t.get('Memos') == [{'Memo': {'MemoType': b'researchagent/escrow-v1'.hex().upper(), 'MemoData': __import__('researchagent.verify', fromlist=['canonical']).canonical(terms).encode().hex().upper()}}] and isinstance(t.get('Sequence'), int) and t['Sequence'] > 0 and isinstance(t.get('LastLedgerSequence'), int) and 0 < int(t.get('Fee', 0)) <= 2000

    def credit(meta, terms, recipient):
        asset = terms['asset']
        if asset == 'XRP':
            return True
        deltas = []
        for node in meta.get('AffectedNodes', []):
            n = node.get('ModifiedNode', {})
            f, p = n.get('FinalFields', {}), n.get('PreviousFields', {})
            low, high = f.get('LowLimit', {}).get('issuer'), f.get('HighLimit', {}).get('issuer')
            if n.get('LedgerEntryType') == 'RippleState' and f.get('Balance', {}).get('currency') == asset['currency'] and {low, high} == {recipient, asset['issuer']}:
                deltas.append((Decimal(f['Balance']['value'])-Decimal(p['Balance']['value'])) * (1 if low == recipient else -1))
        return len(deltas) == 1 and deltas[0] == Decimal(terms['amount'])

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
                t, meta, n = tx(p['txHash'])
                finish = p['escrowState'] == 'RELEASED'
                return credit(meta, key_terms(terms), terms['payTo'] if finish else terms['payer']) and p['escrowState'] in ('RELEASED', 'CANCELLED') and t.get('TransactionType') == ('EscrowFinish' if finish else 'EscrowCancel') and t.get('Owner') == terms['payer'] and t.get('OfferSequence') == p['escrowCreateSequence'] and (not finish or t.get('Condition') == terms['condition'] and (not terms.get('keyReveal') or bool(re.fullmatch('A0228020[A-F0-9]{64}', t.get('Fulfillment',''))) and 'A0258020'+hashlib.sha256(bytes.fromhex(t['Fulfillment'][8:])).hexdigest().upper()+'810120' == terms['condition'])) and p['amountDrops'] == (terms['amount'] if finish else '0') and (p['ledgerIndex'] == '' or n == p['ledgerIndex'])
            check(('escrow-finish ' if p['escrowState'] == 'RELEASED' else 'escrow-cancel ') + name, terminal)
            if terms.get('holdback'):
                h = p['holdback']
                def batch(p=p, terms=terms, h=h):
                    from .verify import find
                    proof = find(b.get('holdbacks', []), intentId=p['intentId'])
                    outer, _, ledger = tx(h['batchHash'])
                    if not all(outer.get(k) == v for k, v in proof['batch'].items()):
                        return False
                    for index, identity in enumerate((p['escrowCreateHash'], h['createHash'])):
                        inner, meta, n = tx(identity)
                        raw = outer['RawTransactions'][index]['RawTransaction']
                        if n != ledger or meta.get('ParentBatchID') != h['batchHash'] or not holdback_create_ok(inner, terms, index == 1) or not all(inner.get(k) == v for k, v in raw.items()):
                            return False
                        objects = [node['CreatedNode'].get('NewFields', {}) for node in meta.get('AffectedNodes', []) if node.get('CreatedNode', {}).get('LedgerEntryType') == 'Escrow']
                        if not any(all(obj.get(k) == raw.get(k) for k in ('Account', 'Destination', 'Amount', 'Condition', 'CancelAfter')) and not obj.get('FinishAfter') for obj in objects):
                            return False
                    return True
                check('holdback-batch ' + name, batch)
                if h['state'] != 'pending':
                    def holdback(p=p, terms=terms, h=h):
                        from .verify import find
                        terminal = find(b['holdbacks'], intentId=p['intentId'])['terminal']
                        t, meta, n = tx(h['finishHash'] if h['state'] == 'released' else h['cancelHash'])
                        return all(t.get(k) == v for k, v in terminal.items()) and holdback_terminal_ok(t, terms, h) and n == h['ledgerIndex'] and credit(meta, dict(terms, amount=h['amount']), terms['payTo'] if h['state'] == 'released' else terms['payer'])
                    check('holdback-' + h['state'] + ' ' + name, holdback)
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
                terms = d.get('terms') or json.loads(invoice)
                canonical = __import__('researchagent.verify', fromlist=['canonical']).canonical
                return create_ok(t, terms) and hashlib.sha256(canonical(terms).encode()).hexdigest().upper() == d['invoiceHash'] and t.get('Account') == d['owner'] and t.get('Sequence') == d['createSequence'] and key_terms(terms)['amount'] == d['amountDrops'] and t.get('Destination') == d['payTo'] and t.get('CancelAfter') == d['cancelAfter']
            return t.get('TransactionType') == ('EscrowFinish' if e['kind'] == 'ESCROW_FINISH' else 'EscrowCancel') and t.get('Owner') == d['owner'] and t.get('OfferSequence') == d['createSequence']
        check(e['kind'].lower().replace('_', '-') + ' ' + e['intentId'], event)
        if e['kind'] == 'ESCROW_FINISH':
            def proof(e=e, d=d):
                if not event(e, d):
                    return False
                if d.get('proofOk') is True:
                    return True
                holdback = next((p.get('holdback') for p in b['payments'] if p['intentId'] == e['intentId']), None)
                if holdback:
                    # The separate holdback check reports its pending/refunded state; no full-refund claim.
                    return holdback.get('checks') == 'fail' and holdback['state'] in ('pending', 'refunded')
                r = next(r for r in entries if r['kind'] == 'refund' and r['intentId'] == e['intentId'] and r['data']['originalTxHash'] == d['txHash'])
                c = next(c['data'] for c in entries if c['kind'] == 'ESCROW_CREATE' and c['intentId'] == e['intentId'])
                create, _, _ = tx(c['txHash'])
                terms = json.loads(bytes.fromhex(create['Memos'][0]['Memo']['MemoData']).decode())
                return create_ok(create, terms) and d.get('proofOk') is False and payment(r['data']['txHash'], c['payTo'], d['owner'], c['amountDrops'], d['txHash'], terms['asset'])
            check('key-reveal-proof ' + e['intentId'], proof)
