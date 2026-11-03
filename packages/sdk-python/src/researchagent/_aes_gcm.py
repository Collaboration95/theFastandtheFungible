"""AES-256-GCM decryption for public receipt evidence (no signing or encryption).

FIPS-197 AES rounds and SP800-38D GHASH; variable-time code for public ledger keys.
"""
import hmac


def _mul(a, b):
    out = 0
    for _ in range(8):
        if b & 1:
            out ^= a
        a = ((a << 1) ^ (0x11b if a & 128 else 0)) & 255
        b >>= 1
    return out


def _sbox(x):
    y, base, power = 1, x, 254
    while power:
        if power & 1:
            y = _mul(y, base)
        base = _mul(base, base)
        power >>= 1
    y = y if x else 0
    return y ^ ((y << 1 | y >> 7) & 255) ^ ((y << 2 | y >> 6) & 255) ^ ((y << 3 | y >> 5) & 255) ^ ((y << 4 | y >> 4) & 255) ^ 0x63


_S = [_sbox(x) for x in range(256)]


def _aes(key):
    words = [list(key[i:i+4]) for i in range(0, 32, 4)]
    rc = 1
    for i in range(8, 60):
        t = words[-1][:]
        if i % 8 == 0:
            t = [_S[x] for x in t[1:] + t[:1]]
            t[0] ^= rc
            rc = _mul(rc, 2)
        elif i % 8 == 4:
            t = [_S[x] for x in t]
        words.append([a ^ b for a, b in zip(words[i-8], t)])
    rounds = [sum(words[i:i+4], []) for i in range(0, 60, 4)]

    def block(data):
        s = [a ^ b for a, b in zip(data, rounds[0])]
        for r in range(1, 15):
            s = [_S[s[4*((c+row) % 4)+row]] for c in range(4) for row in range(4)]
            if r < 14:
                mixed = []
                for c in range(4):
                    a = s[4*c:4*c+4]
                    for j in range(4):
                        mixed.append(_mul(a[j], 2) ^ _mul(a[(j+1) % 4], 3) ^ a[(j+2) % 4] ^ a[(j+3) % 4])
                s = mixed
            s = [a ^ b for a, b in zip(s, rounds[r])]
        return bytes(s)
    return block


def decrypt(key, iv, ciphertext, tag):
    if len(key) != 32 or len(iv) != 12 or len(tag) != 16:
        raise ValueError('AES-GCM sizes')
    aes = _aes(key)
    h = int.from_bytes(aes(bytes(16)), 'big')

    def product(x):
        z, v = 0, h
        for i in range(127, -1, -1):
            if (x >> i) & 1:
                z ^= v
            v = (v >> 1) ^ (0xe1000000000000000000000000000000 if v & 1 else 0)
        return z
    y = 0
    for i in range(0, len(ciphertext), 16):
        y = product(y ^ int.from_bytes(ciphertext[i:i+16].ljust(16, b'\0'), 'big'))
    y = product(y ^ (len(ciphertext)*8))
    expected = (y ^ int.from_bytes(aes(iv + b'\0\0\0\1'), 'big')).to_bytes(16, 'big')
    if not hmac.compare_digest(expected, tag):
        raise ValueError('AES-GCM authentication')
    out = bytearray()
    for i in range(0, len(ciphertext), 16):
        stream = aes(iv + (2+i//16).to_bytes(4, 'big'))
        out.extend(a ^ b for a, b in zip(ciphertext[i:i+16], stream))
    return bytes(out)
