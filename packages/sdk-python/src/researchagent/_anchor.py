"""Pure anchor-transaction binding check; the read-only lookup lives in _ledger."""
import hashlib


def check(anchor, run_id, head, result):
    tx = result.get('tx_json', result)
    if anchor['head'] != head or anchor['runIdHash'] != hashlib.sha256(run_id.encode()).hexdigest():
        return 'Anchor head or run ID hash mismatch'
    if result.get('validated') is not True or result.get('meta', {}).get('TransactionResult') != 'tesSUCCESS':
        return 'Anchor is not validated tesSUCCESS'
    if (tx.get('Account') != anchor['account'] or str(tx.get('hash', result.get('hash', ''))).upper() != anchor['txHash'] or result.get('ledger_index') != anchor['ledgerIndex'] or tx.get('Fee') != anchor['feeDrops']):
        return 'Anchor account, hash, ledger or fee mismatch'
    if tx.get('TransactionType') != 'AccountSet' and not (tx.get('TransactionType') == 'Payment' and tx.get('Account') == tx.get('Destination') and tx.get('Amount') == '1'):
        return 'Unexpected anchor transaction type'
    memos = tx.get('Memos', [])
    memo = memos[0].get('Memo', {}) if len(memos) == 1 else {}
    if str(memo.get('MemoType', '')).upper() != b'researchagent/anchor-v1'.hex().upper() or str(memo.get('MemoData', '')).upper() != (head + ':' + anchor['runIdHash']).encode().hex().upper():
        return 'Anchor memo head mismatch'
    return None
