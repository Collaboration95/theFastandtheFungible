"""NIST AES-256-GCM known-answer vectors, independent of the TS producer."""
import pytest
from researchagent._aes_gcm import decrypt


def test_nist_zero_key_empty():
    assert decrypt(bytes(32), bytes(12), b'', bytes.fromhex('530f8afbc74536b9a963b4f1c4cb738b')) == b''


def test_nist_zero_key_block():
    ct = bytes.fromhex('cea7403d4d606b6e074ec5d3baf39d18')
    tag = bytes.fromhex('d0d1c8a799996bf0265b98b5d48ab919')
    assert decrypt(bytes(32), bytes(12), ct, tag) == bytes(16)
    with pytest.raises(ValueError):
        decrypt(bytes(32), bytes(12), ct, bytes(16))
