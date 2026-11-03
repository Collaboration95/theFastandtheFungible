Vendored ecdsa 0.19.1 (MIT) and six 1.17.0 (MIT), from PyPI wheels. Test modules omitted; six imports relocated to researchagent._vendor. No algorithms changed. Optional gmpy acceleration is not required. Only verification APIs are used. Upstream: https://github.com/tlsfuzzer/python-ecdsa and https://github.com/benjaminp/six. See adjacent licenses.

Pinned wheel SHA-256:
- ecdsa-0.19.1-py2.py3-none-any.whl: 30638e27cf77b7e15c4c4cc1973720149e1033827cfd00661ca5c8cc0cdb24c3
- six-1.17.0-py2.py3-none-any.whl: 4721f391ed90541fddacab5acf947aa0d3dc7d27b2e1e8eda2be8970586c3274

Only public signature verification is supported by ResearchAgent. The vendor
also contains upstream signing APIs; ResearchAgent does not use these in runtime.
Do not use this non-constant-time Python package for production secret signing.
