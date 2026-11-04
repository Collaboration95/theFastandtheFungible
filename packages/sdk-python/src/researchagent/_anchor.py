"""Bounded, read-only Testnet WebSocket lookup using only the standard library."""
import base64
import hashlib
import json
import os
import socket
import ssl
import struct
import threading
import time

_LIMIT = 256 * 1024
_SLOTS = threading.BoundedSemaphore(2)
_ENDPOINTS = ('s.altnet.rippletest.net', 'clio.altnet.rippletest.net')


def _lookup(host, tx_hash):
    deadline = time.monotonic() + 5
    with socket.create_connection((host, 51233), timeout=5) as raw:
        raw.settimeout(max(.001, deadline - time.monotonic()))
        with ssl.create_default_context().wrap_socket(raw, server_hostname=host) as sock:
            def read(n):
                data = b''
                while len(data) < n:
                    sock.settimeout(max(.001, deadline - time.monotonic()))
                    if time.monotonic() >= deadline:
                        raise ValueError('Ledger timeout')
                    part = sock.recv(n - len(data))
                    if not part:
                        raise ValueError('Ledger closed')
                    data += part
                return data

            key = base64.b64encode(os.urandom(16)).decode()
            sock.sendall((f'GET / HTTP/1.1\r\nHost: {host}:51233\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
            headers = b''
            while not headers.endswith(b'\r\n\r\n'):
                headers += read(1)
                if len(headers) > 16384:
                    raise ValueError('Oversized handshake')
            accept = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
            if not headers.startswith(b'HTTP/1.1 101 ') or b'sec-websocket-accept: ' + accept.lower() not in headers.lower():
                raise ValueError('Invalid WebSocket handshake')
            payload = json.dumps(dict(id='anchor', command='tx', transaction=tx_hash, binary=False)).encode()
            mask = os.urandom(4)
            sock.sendall(bytes([0x81, 0x80 | 126]) + struct.pack('!H', len(payload)) + mask + bytes(v ^ mask[i % 4] for i, v in enumerate(payload)))
            message = b''
            consumed = 0
            while True:
                first, second = read(2)
                n = second & 127
                if n == 126:
                    n = struct.unpack('!H', read(2))[0]
                elif n == 127:
                    n = struct.unpack('!Q', read(8))[0]
                consumed += n
                if consumed > _LIMIT or second & 128 or first & 0x70:
                    raise ValueError('Oversized or invalid ledger frame')
                data = read(n)
                opcode = first & 15
                if opcode == 8:
                    raise ValueError('Ledger closed')
                if opcode in (9, 10):
                    continue
                if opcode not in (0, 1):
                    raise ValueError('Invalid ledger frame')
                message += data
                if first & 128:
                    result = json.loads(message)
                    if result.get('id') != 'anchor' or result.get('error'):
                        raise ValueError('Transaction unavailable')
                    return result['result']


def lookup(tx_hash):
    with _SLOTS:
        for host in _ENDPOINTS:
            try:
                return _lookup(host, tx_hash)
            except (OSError, ValueError, KeyError):
                pass
    raise ValueError('Read-only Testnet lookup unavailable')


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
