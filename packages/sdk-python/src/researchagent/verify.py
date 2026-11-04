"""Independent offline receipt verifier. No network, subprocess, signer or Node."""

from __future__ import annotations
import hashlib
import json
import math
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit
from ._vendor.ecdsa import VerifyingKey, SECP256k1, Ed25519
from ._vendor.ecdsa.util import sigdecode_der


def compact(v):
    if isinstance(v, dict):
        return "{" + ",".join(compact(k) + ":" + compact(x) for k, x in v.items()) + "}"
    if isinstance(v, list):
        return "[" + ",".join(map(compact, v)) + "]"
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        v = float(v)  # JSON numbers have ECMAScript binary64 semantics.
        if not math.isfinite(v):
            raise ValueError("Non-finite number")
        if v == 0:
            return "0"
        s = repr(v).lower()
        if "e" in s:
            mant, exp = s.split("e")
            n = int(exp)
            if -6 <= n < 21:
                from decimal import Decimal

                return format(Decimal(s), "f")
            return (
                mant.removesuffix(".0") + "e" + ("+" if n >= 0 else "-") + str(abs(n))
            )
        return s.removesuffix(".0")
    if isinstance(v, str):
        v = v.encode("utf-16-le", "surrogatepass").decode("utf-16-le", "surrogatepass")
    encoded = json.dumps(v, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return re.sub(
        r"[\ud800-\udfff]", lambda m: "\\u" + format(ord(m[0]), "04x"), encoded
    )


def canonical(v):
    if isinstance(v, dict):
        return (
            "{"
            + ",".join(
                compact(k) + ":" + canonical(v[k])
                for k in sorted(v, key=lambda s: s.encode("utf-16-be", "surrogatepass"))
            )
            + "}"
        )
    if isinstance(v, list):
        return "[" + ",".join(map(canonical, v)) + "]"
    return compact(v)


def sha(s):
    return hashlib.sha256(
        s.encode("utf-16-le", "surrogatepass")
        .decode("utf-16-le", "replace")
        .encode("utf-8")
    ).hexdigest()


def leaf(salt, index, span, text):
    return sha("\x1f".join((salt, str(index), span, text)))


def key(s):
    v = s.get("source")
    return (
        compact(
            [
                v[k]
                for k in ("origin", "sellerKey", "profileId", "resourceId", "version")
            ]
        )
        if v
        else s["resourceId"] + "@" + s["version"]
    )


def find(rows, **fields):
    return next((r for r in rows if all(r.get(k) == v for k, v in fields.items())), {})


def bykey(rows, s):
    return next((r for r in rows if key(r) == key(s)), {})


def unique(xs):
    return len(xs) == len(set(xs))


def schema(v, s):
    """Validate and strip unknown object keys just as Zod's default object parser."""
    if "anyOf" in s:
        for sub in s["anyOf"]:
            try:
                return schema(v, sub)
            except (ValueError, TypeError, KeyError):
                pass
        raise ValueError("union")
    if "const" in s and (type(v) != type(s["const"]) or v != s["const"]):
        raise ValueError("literal")
    if "enum" in s and v not in s["enum"]:
        raise ValueError("enum")
    t = s.get("type")
    if isinstance(t, list):
        return schema(
            v, {**s, "type": "null" if v is None else next(x for x in t if x != "null")}
        )
    if t == "object":
        if not isinstance(v, dict):
            raise ValueError("object")
        if any(k not in v for k in s.get("required", [])):
            raise ValueError("required")
        props = s.get("properties", {})
        extra = s.get("additionalProperties", True)
        if extra is False and any(k not in props for k in v):
            raise ValueError("strict object")
        result = {
            k: schema(x, props[k] if k in props else extra)
            for k, x in v.items()
            if k in props or isinstance(extra, dict)
        }
        if "leaves" in props or (
            "currency" in props and "issuer" in props and "label" in props
        ):
            refinements(result, recurse=False)
        return result
    if t == "array":
        if not isinstance(v, list) or len(v) < s.get("minItems", 0):
            raise ValueError("array")
        return [schema(x, s["items"]) for x in v]
    if t in ("number", "integer"):
        if (
            type(v) not in (int, float)
            or not math.isfinite(v)
            or t == "integer"
            and int(v) != v
        ):
            raise ValueError("number")
        if (
            v < s.get("minimum", -math.inf)
            or v > s.get("maximum", math.inf)
            or v <= s.get("exclusiveMinimum", -math.inf)
        ):
            raise ValueError("bounds")
    if t == "string":
        if not isinstance(v, str) or not s.get("minLength", 0) <= len(v.encode("utf-16-le", "surrogatepass")) // 2 <= s.get("maxLength", math.inf):
            raise ValueError("string")
        pattern = s.get("pattern")
        if pattern:
            if "\\p{L}" in pattern:
                phrases = re.split("[ -]", v)
                if not 1 <= len(phrases) <= 6 or not all(p and all(c.isalpha() for c in p) for p in phrases):
                    raise ValueError("phrase")
            elif not re.search(pattern, v):
                raise ValueError("pattern")
        if s.get("format") == "uri":
            url = urlsplit(v)
            if not url.scheme or not (url.netloc or url.path):
                raise ValueError("url")
            if url.scheme in ("http", "https", "ftp", "ws", "wss"):
                if not url.hostname or any(
                    c.isspace() or c in "<>^`{}|" for c in url.hostname
                ):
                    raise ValueError("url")
                _ = url.port  # Reject malformed or out-of-range ports.
    if t == "boolean" and type(v) != bool:
        raise ValueError("boolean")
    if t == "null" and v is not None:
        raise ValueError("null")
    return v


def refinements(v, recurse=True):
    if isinstance(v, list):
        for x in v:
            refinements(x)
    elif isinstance(v, dict):
        if (
            "pubKey" in v
            and "leaves" in v
            and v.get("schemaVersion") != 2
            and any(c.get("covers") for c in v["claims"])
        ):
            raise ValueError("fact menus require v2")
        if v.get("currency") == "524C555344000000000000000000000000000000":
            labels = (
                ["RLUSD (Testnet)", "RLUSD Testnet"]
                if v["issuer"] == "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV"
                else ["test USD (substitute for RLUSD)"]
            )
            if v["label"] not in labels:
                raise ValueError("asset label")
        if recurse:
            for x in v.values():
                refinements(x)


def signed(m, message_override=None):
    try:
        pub = bytes.fromhex(m["pubKey"])
        sig = bytes.fromhex(m["sig"])
        payload = (
            b"\x00" + hashlib.new("ripemd160", hashlib.sha256(pub).digest()).digest()
        )
        payload += hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]
        alphabet = "rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz"
        n = int.from_bytes(payload, "big")
        address = ""
        while n:
            n, r = divmod(n, 58)
            address = alphabet[r] + address
        address = alphabet[0] * (len(payload) - len(payload.lstrip(b"\0"))) + address
        if address != m["wallet"]:
            return False
        message = (
            (
                "researchagent-manifest-v2:"
                if m.get("schemaVersion") == 2
                else "researchagent-manifest-v1:"
            )
            + canonical({k: v for k, v in m.items() if k != "sig"})
        ).encode()
        if message_override is not None:
            message = message_override
        if pub[0] == 0xED:
            vk = VerifyingKey.from_string(pub[1:], curve=Ed25519)
            # Match ripple-keypairs' noble zip215=false: canonical points,
            # reject small-order public keys, then use the cofactored equation.
            from ._vendor.ecdsa.ellipticcurve import PointEdwards, INFINITY

            if len(sig) != 64:
                return False
            point = vk.pubkey.point
            rpoint = PointEdwards.from_bytes(Ed25519.curve, sig[:32])
            for raw, decoded in ((pub[1:], point), (sig[:32], rpoint)):
                if int.from_bytes(raw, "little") & ((1 << 255) - 1) >= 2**255 - 19:
                    return False
                if decoded.x() == 0 and raw[31] & 128:
                    return False
            if point * 8 == INFINITY:
                return False
            scalar = int.from_bytes(sig[32:], "little")
            if scalar >= Ed25519.order:
                return False
            challenge = int.from_bytes(
                hashlib.sha512(sig[:32] + pub[1:] + message).digest(), "little"
            )
            return (
                rpoint
                + point * challenge
                + Ed25519.generator * (-scalar % Ed25519.order)
            ) * 8 == INFINITY
        if pub[0] not in (2, 3):
            return False
        _, s = sigdecode_der(sig, SECP256k1.order)
        if s > SECP256k1.order // 2:
            return False
        return VerifyingKey.from_string(pub, curve=SECP256k1).verify_digest(
            sig, hashlib.sha512(message).digest()[:32], sigdecode=sigdecode_der
        )
    except Exception:  # Invalid curve points, DER encodings and signatures fail closed.
        return False


MONTH = r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
DATE = re.compile(
    r"\b(?:\d{4}-\d{2}-\d{2}|"
    + MONTH
    + r"\.?(?:\s+\d{1,2}(?:st|nd|rd|th)?,?)?\s+\d{4}|\d{1,2}\s+"
    + MONTH
    + r"\s+\d{4}|(?:Q[1-4]|H[12]|FY)\s?\x27?\d{2,4}|(?:19|20)\d{2})\b",
    re.I | re.ASCII,
)
UNIT = re.compile(
    r"(?:[$€£¥]\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:%|percent|per cent|bps?|basis points|nm|[MGK]W|[MGT]Wh|wafers?|units|billion|million|trillion|bn|tn|yen|dollars|x)(?![A-Za-z]))",
    re.I | re.ASCII,
)


def claim_ok(text, c):
    kind = c["kind"]
    if kind == "dated-figure":
        ok = any(
            DATE.search(s) and re.search("[0-9]", DATE.sub(" ", s))
            for s in re.split(r"(?<=[.!?])\s+", text)
        )
    elif kind == "numeric-series":
        ok = len(UNIT.findall(text)) >= 3
    else:
        ok = bool(
            re.search(
                r'\b[Aa]ccording to (?:the )?[A-Z][\w&.-]*|["“][^"”]{3,}["”],?\s+(?:said|says|wrote|writes|told)\s+(?:the\s+)?[A-Z]|\b[A-Z][\w.-]*(?:\s+[A-Z][\w.-]*)*,?\s+(?:said|says|wrote|writes|told \w+)[,:]?\s*["“]',
                text,
                re.ASCII,
            )
        )

    def menu(t):
        return re.sub(
            "[^a-z0-9]+", " ", re.sub("[’']", "", re.sub("[’']s\\b", "", t.lower()))
        ).strip()

    years = [
        "twenty twenty three",
        "twenty twenty four",
        "twenty twenty five",
        "twenty twenty six",
        "twenty twenty seven",
        "twenty twenty eight",
        "twenty twenty nine",
        "twenty thirty",
    ]
    period = text
    for y, w in zip(range(2023, 2031), years):
        period = period.replace(str(y), w)
    return ok and all(
        " " + menu(v) + " " in " " + menu(period if k == "period" else text) + " "
        for k, v in c.get("covers", {}).items()
    )


def contributions(b):
    purchases = []
    final = b["answers"][-1]
    for receipt in b["receipts"]:
        i = find(b["intents"], intentId=receipt["intentId"])
        grant = next(
            (
                g
                for g in b["grants"]
                if g["intentId"] == i["intentId"] and key(g) == key(i)
            ),
            {},
        )
        source = bykey(b["sources"], i)
        links = []
        if i["status"] == "VERIFIED" and grant and source:
            for a in b["answers"]:
                for c in a["claims"]:
                    refs = {
                        compact([key(r), r["spanId"]]): r
                        for r in c["citations"]
                        if key(r) == key(i)
                    }
                    for identity, r in refs.items():
                        span = find(source["spans"], id=r["spanId"])
                        if span:
                            links.append(
                                dict(
                                    answerVersion=a["version"],
                                    claimId=c["id"],
                                    claim=c["text"],
                                    citation=identity,
                                    spanId=span["id"],
                                    passage=span["text"],
                                    manifestRoot=grant["contentDigest"],
                                    grantIntentId=grant["intentId"],
                                    retained=any(
                                        fc["id"] == c["id"]
                                        and fc["text"] == c["text"]
                                        and any(
                                            compact([key(fr), fr["spanId"]]) == identity
                                            for fr in fc["citations"]
                                        )
                                        for fc in final["claims"]
                                    ),
                                )
                            )
        refund = i.get("refund", {}).get("amountMinor", 0)
        status = (
            "recorded verified refund"
            if i.get("refund")
            else "pending"
            if i.get("refundCandidate") or i["status"] == "CHALLENGED"
            else "refused"
            if i["status"] in ("CHALLENGE_REFUSED", "CHALLENGE_REJECTED")
            else "none"
        )
        purchases.append(
            dict(
                intentId=i["intentId"],
                sourceKey=key(i),
                status=i["status"],
                grossMinor=receipt["amountMinor"],
                refundMinor=refund,
                netMinor=receipt["amountMinor"] - refund,
                refundStatus=status,
                assessment="not assessed",
                structuralUse="cited"
                if any(l["answerVersion"] == final["version"] for l in links)
                else "none",
                links=links,
            )
        )
    return dict(
        version="structural-v1",
        semanticStatus="not independently verified",
        purchases=purchases,
    )


def verify(export, *, expect_head=None, ledger=False, ledger_lookup=None, testnet=False):
    """Verify a dict or JSON path; valid means internal consistency, not ledger truth."""
    checks = [dict(check="writer credentials", status="SKIP", detail="Unsigned advisory identity; requires online check")]

    def add(name, ok, detail="Offline structural check"):
        checks.append(dict(check=name, status="PASS" if ok else "FAIL", detail=detail))

    def skip(name, detail):
        checks.append(dict(check=name, status="SKIP", detail=detail))

    try:
        if isinstance(export, (str, Path)):
            export = json.loads(Path(export).read_text(encoding="utf-8"))
        b = schema(
            export.get("verification", export),
            json.loads(Path(__file__).with_name("bundle-schema.json").read_text()),
        )
        for p in b['proofs']:
            reveal = p.get('keyReveal')
            intent = next((i for i in b['intents'] if i['intentId'] == p.get('intentId')), {})
            if reveal:
                from ._aes_gcm import decrypt
                q, k = reveal['quote'], bytes.fromhex(reveal['key'])
                t = q['terms']
                c = t['keyReveal']
                ct = bytes.fromhex(q['ciphertext'])
                signature = signed(dict(pubKey=q['pubKey'], sig=q['sig'], wallet=t['payTo']), ('researchagent/escrow-quote-v1:' + canonical(t)).encode())
                data = decrypt(k, bytes.fromhex(c['iv']), ct, bytes.fromhex(c['tag']))
                d = json.loads(data)
                source = next(x for x in b['sources'] if key(x) == key(p))
                e = intent.get('escrow', {})
                add('key reveal ' + key(p), signature and t['condition'] == 'A0258020' + hashlib.sha256(k).hexdigest().upper() + '810120' and hashlib.sha256(ct).hexdigest() == c['ciphertextHash'] and hashlib.sha256(data).hexdigest() == c['plaintextHash'] and d['body'] == source['body'] and [{k: x[k] for k in ('id', 'text')} for x in d['passages']] == [{k: x[k] for k in ('id', 'text')} for x in source['spans']] and d['salts'] == p['salts'] and d['articleId'] == source['resourceId'] and d['version'] == source['version'] and t['manifestRoot'] == p['manifest']['root'] and q['pubKey'] == p['manifest']['pubKey'] and t['intentId'] == p['intentId'] and e.get('mode') == 'key-reveal' and reveal['createHash'] == e.get('createHash') and reveal['finishHash'] == e.get('finishHash') and reveal['ledgerIndex'] == e.get('revealLedger') and canonical(t) == intent.get('quote', {}).get('quoteId'))
            elif intent.get('escrow', {}).get('mode') == 'key-reveal':
                add('key reveal missing', False)
        if b["schemaVersion"] == 3:
            add(
                "contribution dispatch",
                bool(b.get("identityVersion") and b.get("contributions")),
            )
            add(
                "contributions",
                canonical(b.get("contributions")) == canonical(contributions(b)),
            )
        else:
            add(
                "legacy dispatch",
                not b.get("contributions") and not b.get("identityVersion"),
            )
        refs = [
            *b["sources"],
            *b["candidates"],
            *b["intents"],
            *b["grants"],
            *b["receipts"],
            *[i["quote"] for i in b["intents"] if i.get("quote")],
            *b["proofs"],
            *[r for a in b["answers"] for c in a["claims"] for r in c["citations"]],
        ]
        entries = [e for e in b["audit"]["entries"] if "commitment" not in e]
        if b.get("identityVersion", b["schemaVersion"]) == 1:
            add("version", not any(r.get("source") for r in refs))
            skip("historical origin", "v1 origin unresolved")
        else:
            add(
                "source binding",
                all(
                    r.get("source")
                    and r["source"]["resourceId"] == r["resourceId"]
                    and r["source"]["version"] == r["version"]
                    and (
                        not r.get("profileId")
                        or r["profileId"] == r["source"]["profileId"]
                    )
                    for r in refs
                ),
            )
            for i in b["intents"]:

                def origin(kind):
                    return any(
                        e["kind"] == kind
                        and e["intentId"] == i["intentId"]
                        and e["data"].get("source")
                        and key(e["data"]) == key(i)
                        for e in entries
                    )

                q = i.get("quote")
                same = not q or key(q) == key(i)
                refused = (
                    i["status"] == "SKIPPED"
                    and not any(i.get(k) for k in ("txHash", "receiptId", "escrow"))
                    and same
                    and not any(
                        r["intentId"] == i["intentId"]
                        for r in [*b["payments"], *b["receipts"], *b["grants"]]
                    )
                    and not any(
                        e["intentId"] == i["intentId"]
                        and e["kind"]
                        in ("sign", "escrow-sign", "settle", "ESCROW_CREATE")
                        for e in entries
                    )
                    and origin("refusal")
                )
                add(
                    "origin reservation " + i["intentId"],
                    bool(origin("reserve") and q and same or refused),
                )
        add(
            "identities",
            all(
                unique(xs)
                for xs in (
                    [key(s) for s in b["sources"]],
                    [key(p) for p in b["proofs"]],
                    [i["intentId"] for i in b["intents"]],
                    [p["intentId"] for p in b["payments"]],
                )
            ),
        )
        prev = b["audit"]["anchor"]["hash"]
        seq = b["audit"]["anchor"]["seq"]
        chain = seq != 0 or prev == "0" * 64
        for e in b["audit"]["entries"]:
            ok = (
                e["seq"] == seq + 1
                and e["prevHash"] == prev
                and (
                    "commitment" in e
                    or e["hash"]
                    == sha(
                        compact(
                            [
                                e["seq"],
                                e["at"],
                                prev,
                                e["runId"],
                                e["intentId"],
                                e["surface"],
                                e["principal"],
                                e["kind"],
                                canonical(e["data"]),
                            ]
                        )
                    )
                )
            )
            chain = chain and ok
            seq = e["seq"]
            prev = e["hash"]
        add(
            "audit chain",
            chain
            and bool(b["audit"]["entries"])
            and prev == b["audit"]["head"]
            and (not expect_head or prev == expect_head),
        )
        anchor = b.get('ledgerAnchor')
        if anchor:
            commitment = next((e for e in entries if e['kind'] == 'answer-anchor' and e['runId'] == b['runId'] and e['hash'] == b['audit']['head']), {})
            add('anchor binding', all(p['payer'] == anchor['account'] for p in b['payments'] if p['kind'] == 'purchase') and anchor['head'] == prev and anchor['runIdHash'] == sha(b['runId']) and commitment.get('data', {}).get('answersHash') == sha(canonical(b['answers'])), 'Anchor head, run and answer commitment agree')
        if ledger:
            from ._anchor import check
            from ._ledger import lookup
            try:
                if not anchor and 'SIMULATED' in b['label']:
                    skip('audit anchor', 'simulated run (no ledger)')
                elif not anchor:
                    raise ValueError('No ledger anchor in export')
                if anchor:
                    reason = check(anchor, b['runId'], prev, (ledger_lookup or lookup)(anchor['txHash']))
                    add('audit anchor', chain and reason is None, reason or ('Validated XRPL Testnet ledger ' + str(anchor['ledgerIndex']) if chain else 'Audit head mismatch'))
            except (OSError, ValueError, KeyError, TypeError) as error:
                add('audit anchor', False, str(error))
        else:
            skip('audit anchor', 'not anchored (simulated); requires online check' if 'SIMULATED' in b['label'] else 'requires online check (--ledger)')
        source_ok = {}
        for s in b["sources"]:
            ps = [p for p in b["proofs"] if key(p) == key(s)]
            cs = [c for c in b["candidates"] if key(c) == key(s)]
            p = ps[0] if ps else {}
            c = cs[0] if cs else {}
            m = p.get("manifest", {})
            bound = (
                len(ps) == len(cs) == 1
                and m["articleId"] == s["resourceId"]
                and m["version"] == s["version"]
                and m["publisherSlug"] == s["profileId"]
                and (not s.get("source") or s["source"]["sellerKey"] == m["pubKey"])
                and c["profileId"] == s["profileId"]
                and (
                    m["priceMinor"] > 0 if c["tier"] == "PAID" else m["priceMinor"] == 0
                )
                and (not c.get("wallet") or c["wallet"] == m["wallet"])
            )
            valid = bool(bound and signed(m))
            source_ok[key(s)] = valid
            add("manifest " + key(s), valid)
            leaves = [
                leaf(p["salts"][n], n, x["id"], x["text"])
                if x["text"] in s["body"] and n < len(p.get("salts", []))
                else ""
                for n, x in enumerate(s["spans"])
            ]
            # Unicode L/N tokens with an optional apostrophe plus letters, as TS.
            token_text = "".join(
                c if unicodedata.category(c)[0] in "LN" or c in "'’" else " "
                for c in s["body"].lower()
            )
            words = re.findall(r"[^\W_]+(?:['’][^\W\d_]+)?", token_text)
            delivery = (
                bound
                and leaves == m["leaves"]
                and sha("".join(m["leaves"])) == m["root"]
                and len(words) == m["wordCount"]
                and all(
                    cl["leaf"] in leaves
                    and claim_ok(s["spans"][leaves.index(cl["leaf"])]["text"], cl)
                    for cl in m["claims"]
                )
                and len(p["salts"]) == len(s["spans"])
                and unique([x["id"] for x in s["spans"]])
            )
            add("passages " + key(s), delivery)
            if c.get("tier") == "PAID":
                i = find(b["intents"], intentId=p.get("intentId"))
                g = find(b["grants"], intentId=p.get("intentId"))
                pay = find(b["payments"], intentId=p.get("intentId"))
                add(
                    "grant " + key(s),
                    i.get("status") == "VERIFIED"
                    and g.get("runId") == b["runId"]
                    and g.get("contentDigest") == m["root"]
                    and key(g) == key(s)
                    and i["profileId"] == s["profileId"]
                    and pay.get("payee") == m["wallet"]
                    and m["priceMinor"] == i["amountMinor"]
                    and any(
                        e["kind"] == "proof"
                        and e["intentId"] == i["intentId"]
                        and e["data"].get("verified") is True
                        and (
                            e["data"].get("scheme") == "escrow-v1"
                            if i.get("escrow")
                            else e["data"].get("contentDigest") == m["root"]
                        )
                        for e in entries
                    ),
                )
        groups = [a["claims"] for a in b["answers"]]
        if "verification" in export and "report" in export:
            report = schema(
                export["report"],
                json.loads(Path(__file__).with_name("report-schema.json").read_text()),
            )
            refunds = [
                dict(
                    intentId=i["intentId"],
                    resourceId=i["resourceId"],
                    version=i["version"],
                    **i["refund"],
                )
                for i in b["intents"]
                if i.get("refund")
            ]
            add(
                "report",
                report.get("access", {}).get("runId") == b["runId"]
                and canonical(report["sources"]) == canonical(b["sources"])
                and canonical(report["receipts"]) == canonical(b["receipts"])
                and canonical(report.get("refunds", [])) == canonical(refunds),
            )
            groups += [
                report.get(k, [])
                for k in ("findings", "firstFindings", "finalFindings")
            ]
        for claims in groups:
            for c in claims:
                for r in c["citations"]:
                    s = bykey(b["sources"], r)
                    p = bykey(b["proofs"], r)
                    n = next(
                        (
                            n
                            for n, x in enumerate(s.get("spans", []))
                            if x["id"] == r["spanId"]
                        ),
                        -1,
                    )
                    exact = (
                        n >= 0
                        and p
                        and s["spans"][n]["text"] in s["body"]
                        and leaf(p["salts"][n], n, r["spanId"], s["spans"][n]["text"])
                        == p["manifest"]["leaves"][n]
                        and sha("".join(p["manifest"]["leaves"]))
                        == p["manifest"]["root"]
                    )
                    add("citation " + c["id"], exact and source_ok.get(key(r)) is True)
        for i in b["intents"]:
            if not (i.get("receiptId") or i.get("refund") or i["status"] == "VERIFIED"):
                continue
            rows = [p for p in b["payments"] if p["intentId"] == i["intentId"]]
            row = rows[0] if rows else {}
            receipt = find(b["receipts"], intentId=i["intentId"])
            q = i.get("quote", {})
            terms = q.get("payment", {})
            settle = next(
                (
                    e["data"]
                    for e in entries
                    if e["kind"] == "settle"
                    and e["intentId"] == i["intentId"]
                    and e["runId"] == b["runId"]
                ),
                {},
            )
            refund = next(
                (
                    e["data"]
                    for e in entries
                    if e["kind"] == "refund"
                    and e["intentId"] == i["intentId"]
                    and e["runId"] == b["runId"]
                ),
                {},
            )
            escrow = i.get("escrow")
            amount = lambda asset="XRP": (
                str(i["amountMinor"] * 1000)
                if asset == "XRP"
                else format(i["amountMinor"] / 100, ".2f")
            )
            quote_ok = (
                terms
                and row.get("invoiceId") == terms["invoiceId"]
                and q["quoteHash"] == terms["invoiceId"]
                and (escrow or sha(q["quoteId"]).upper() == terms["invoiceId"])
            )
            if escrow:
                et = row.get("escrowTerms", {})
                invoice_ok = (
                    et
                    and canonical(et) == q["quoteId"]
                    and row.get("escrowState") == escrow["state"]
                    and et["manifestRoot"] == q["contentDigest"]
                    and et["amount"] == amount()
                    and et["payer"] == row["payer"]
                )
            else:
                try:
                    inv = json.loads(q["quoteId"])
                    invoice_ok = (
                        inv["articleId"] == i["resourceId"]
                        and inv["version"] == i["version"]
                        and inv["payTo"] == row.get("payee")
                        and inv["amount"] == row.get("amountDrops")
                        and inv["manifestRoot"] == q["contentDigest"]
                        and canonical(inv.get("asset", "XRP"))
                        == canonical(row.get("asset", "XRP"))
                    )
                except (KeyError, ValueError):
                    invoice_ok = False
            c = next(
                (
                    c
                    for c in b["candidates"]
                    if key(c) == key(i) and c["profileId"] == i["profileId"]
                ),
                {},
            )
            m = c.get("manifest", {})
            writer = (
                c.get("tier") == "PAID"
                and m
                and signed(m)
                and m["articleId"] == i["resourceId"]
                and m["version"] == i["version"]
                and m["publisherSlug"] == i["profileId"]
                and m["wallet"] == terms.get("payTo")
                and m["root"] == q.get("contentDigest")
                and m["priceMinor"] == i["amountMinor"]
            )
            cancelled = escrow and escrow["state"] == "CANCELLED"
            charged = 0 if cancelled else i["amountMinor"]
            ok = (
                len(rows) == 1
                and receipt
                and (not i.get("source") or key(receipt) == key(i))
                and row["runId"] == b["runId"]
                and row["writer"] == i["profileId"]
                and row["resourceId"] == i["resourceId"]
                and row["version"] == i["version"]
                and row["amountMinor"] == charged
                and receipt["amountMinor"] == charged
                and row["label"] == receipt["label"]
                and row["status"] == i["status"]
                and row["txHash"]
                == receipt.get("xrpl", {}).get("txHash", i.get("txHash"))
                and row["amountDrops"]
                == ("0" if cancelled else amount(terms.get("asset", "XRP")))
                and row["payee"] == (row["payer"] if cancelled else terms.get("payTo"))
                and writer
                and canonical(row.get("asset")) == canonical(terms.get("asset"))
                and quote_ok
                and invoice_ok
                and settle.get("txHash") == row["txHash"]
                and settle.get("amountMinor") == row["amountMinor"]
                and settle.get("payTo") == terms.get("payTo")
                and (
                    escrow
                    or any(
                        e["kind"] == "sign"
                        and e["intentId"] == i["intentId"]
                        and e["data"].get("txHash") == row["txHash"]
                        for e in entries
                    )
                )
            )
            add("receipt " + i["intentId"], ok)
            r = i.get("refund", {})
            add(
                "refund " + i["intentId"],
                row
                and row["refundTxHash"] == r.get("txHash", "")
                and row["refundAmountMinor"] == r.get("amountMinor", "")
                and (
                    not r
                    or refund.get("txHash") == r["txHash"]
                    and refund.get("amountMinor") == r["amountMinor"]
                    and refund.get("originalTxHash") == row["txHash"]
                ),
            )
        add(
            "receipt coverage",
            len(b["receipts"]) == sum(p["kind"] == "purchase" for p in b["payments"])
            and all(find(b["intents"], intentId=r["intentId"]) for r in b["receipts"])
            and all(
                any(
                    p["intentId"] == e["intentId"]
                    and p["refundTxHash" if e["kind"] == "refund" else "txHash"]
                    == e["data"].get("txHash")
                    for p in b["payments"]
                )
                for e in entries
                if e["kind"] in ("settle", "refund")
            ),
        )
        for e in entries:
            if e['kind'] == 'ESCROW_FINISH' and e['data'].get('proofOk') is False:
                add('key-reveal-proof ' + e['intentId'], any(r['kind'] == 'refund' and r['intentId'] == e['intentId'] and r['data'].get('originalTxHash') == e['data']['txHash'] and any(p['intentId'] == e['intentId'] and p.get('refundTxHash') == r['data'].get('txHash') for p in b['payments']) for r in entries))
        if testnet or ledger and ('SIMULATED' not in b['label'] or b.get('ledgerAnchor')):
            from ._ledger import lookup, verify_transactions
            verify_transactions(b, entries, ledger_lookup or lookup, add)
            add('testnet coverage', all(p['label'] == 'XRPL TESTNET · no real value' for p in b['payments']), 'All payments must be real Testnet for full on-ledger verification; SIMULATED is not ledger proof')
        else:
            skip("testnet", "simulated run (no ledger)" if ledger else "Payments/refunds NOT checked on ledger; add --ledger (read-only, no keys)")
        return dict(
            ok=all(c["status"] != "FAIL" for c in checks),
            runId=b["runId"],
            checks=checks,
        )
    except (
        ValueError,
        OverflowError,
        KeyError,
        TypeError,
        IndexError,
        AttributeError,
        OSError,
    ) as error:
        add("bundle", False, "Invalid bundle: " + type(error).__name__)
        return dict(ok=False, checks=checks)
