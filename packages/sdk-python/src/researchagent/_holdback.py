"""Holdback structure and quote binding. Transaction authentication needs --ledger."""
from decimal import Decimal
import hashlib
import re


def key_terms(terms):
    if not terms.get('holdback'):
        return terms
    amount = format(Decimal(terms['amount']) - Decimal(terms['holdback']['amount']), 'f')
    return dict(terms, amount=amount.rstrip('0').rstrip('.') if '.' in amount else amount)


def memo_ok(memos, terms):
    from .verify import canonical
    encoded = canonical(terms)
    return memos in ([{'Memo': {'MemoType': b'researchagent/escrow-v1'.hex().upper(), 'MemoData': value.encode().hex().upper()}}] for value in (encoded, 'sha256:' + hashlib.sha256(encoded.encode()).hexdigest()))


def create_ok(tx, terms, held=False):
    value = terms['holdback']['amount'] if held else key_terms(terms)['amount']
    asset = terms['asset']
    actual = tx.get('Amount')
    amount_ok = actual == value if asset == 'XRP' else isinstance(actual, dict) and actual.get('currency') == asset['currency'] and actual.get('issuer') == asset['issuer'] and Decimal(actual['value']) == Decimal(value)
    return tx.get('TransactionType') == 'EscrowCreate' and tx.get('Account') == terms['payer'] and tx.get('Destination') == terms['payTo'] and amount_ok and tx.get('Condition') == (terms['holdback']['condition'] if held else terms['condition']) and tx.get('CancelAfter') == (terms['holdback']['cancelAfter'] if held else terms['cancelAfter']) and memo_ok(tx.get('Memos'), terms) and tx.get('Flags') == 1073741824 and tx.get('Fee') == '0' and tx.get('SigningPubKey') == '' and not any(tx.get(k) for k in ('TxnSignature', 'FinishAfter', 'DestinationTag', 'SourceTag', 'InvoiceID', 'TicketSequence'))


def terminal_ok(tx, terms, holdback):
    if tx.get('Account') != terms['payer'] or tx.get('Owner') != terms['payer'] or tx.get('OfferSequence') != holdback['createSequence']:
        return False
    if holdback['state'] == 'refunded':
        return tx.get('TransactionType') == 'EscrowCancel'
    fulfillment = tx.get('Fulfillment', '')
    return holdback['state'] == 'released' and holdback.get('checks') == 'pass' and tx.get('TransactionType') == 'EscrowFinish' and tx.get('Condition') == holdback['condition'] and bool(re.fullmatch('A0228020[A-F0-9]{64}', fulfillment)) and 'A0258020' + hashlib.sha256(bytes.fromhex(fulfillment[8:])).hexdigest().upper() + '810120' == holdback['condition']


def verify_holdbacks(bundle, entries, add, skip):
    from .verify import canonical, find
    for row in bundle['payments']:
        if row.get('escrowTerms', {}).get('holdback'):
            add('holdback coverage ' + row['intentId'], bool(find(bundle['intents'], intentId=row['intentId']).get('escrow', {}).get('holdback')))
    for intent in bundle['intents']:
        escrow = intent.get('escrow', {})
        h = escrow.get('holdback')
        if not h:
            continue
        ok = False
        try:
            row = find(bundle['payments'], intentId=intent['intentId'])
            proof = find(bundle.get('holdbacks', []), intentId=intent['intentId'])
            terms, batch = row['escrowTerms'], proof['batch']
            pair = [r['RawTransaction'] for r in batch['RawTransactions']]
            minor = Decimal(h['amount']) / (1000 if terms['asset'] == 'XRP' else Decimal('0.01'))
            ok = batch['TransactionType'] == 'Batch' and batch['Account'] == terms['payer'] and batch['Flags'] == 65536 and not batch.get('BatchSigners') and len(pair) == 2 and 0 < int(batch['Fee']) <= 2000 and isinstance(batch['LastLedgerSequence'], int) and all(create_ok(tx, terms, n == 1) and tx['Sequence'] == batch['Sequence'] + n + 1 for n, tx in enumerate(pair)) and pair[0]['Sequence'] == escrow['createSequence'] and pair[1]['Sequence'] == h['createSequence'] and all(h[k] == terms['holdback'][k] for k in ('amount', 'percent', 'condition', 'cancelAfter')) and Decimal(str(h['amountMinor'])) == minor and canonical(h) == canonical(row.get('holdback')) == canonical(find(bundle['receipts'], intentId=intent['intentId']).get('escrow', {}).get('holdback')) and any(e['kind'] == 'escrow-sign' and e['intentId'] == intent['intentId'] and e['data'].get('txHash') == h['batchHash'] for e in entries) and any(e['kind'] == 'ESCROW_CREATE' and e['intentId'] == intent['intentId'] and e['data'].get('txHash') == escrow['createHash'] for e in entries)
            if h['state'] == 'pending':
                ok = ok and not h.get('finishHash') and not h.get('cancelHash') and 'terminal' not in proof
            else:
                operation = 'finishHash' if h['state'] == 'released' else 'cancelHash'
                ok = ok and terminal_ok(proof['terminal'], terms, h) and any(e['kind'] == 'holdback' and e['intentId'] == intent['intentId'] and e['data'].get('txHash') == h[operation] and e['data'].get('state') == h['state'] for e in entries)
        except (ValueError, KeyError, TypeError, IndexError):
            pass
        add('holdback ' + intent['intentId'], bool(ok), 'Two escrow identities; holdback ' + h['state'] + '; offline structural binding')
    if any(i.get('escrow', {}).get('holdback') for i in bundle['intents']):
        skip('holdback transaction authentication', 'Python checks structure offline; use --ledger for transaction authentication, or the TypeScript verifier for offline transaction signatures and hashes')
