"""Summarize only the allowlisted development sweep; never read held-out banks."""
import hashlib
import json
import pathlib
import tarfile

OUT = pathlib.Path('docs/evidence/p1-threshold')
BANKS = ['v1', 'v2', 'v3', 'v3-dev', 'v3-negatives']
GRID = [.10, .15, .20, .26, .281, .30]
waste = {r['threshold']: r['wastedGrossPct'] for r in json.loads((OUT / 'fixture-scorecard-dev.json').read_text())}
summary = []
for threshold in GRID:
    for bank in BANKS:
        directory = OUT / f'{threshold:.3f}-{bank}'
        if not (directory / 'exit.json').exists():
            continue
        result_file = directory / 'results.json'
        if not result_file.exists():
            summary.append({'threshold': threshold, 'bank': bank, 'status': 'failed before results'})
            continue
        data = json.loads(result_file.read_text())
        results = data['results']
        summary.append({'threshold': threshold, 'bank': bank, **data['summary'],
                        'onlineVerification': {'n': sum(r['verificationOk'] for r in results), 'N': len(results)},
                        'gateViolations': sum(len(r['violations']) for r in results),
                        'spentMinor': sum(r['spentMinor'] for r in results),
                        'fixtureScorecardDevWastedGrossPct': waste[threshold],
                        'exit': json.loads((directory / 'exit.json').read_text())})
        members = sorted([*directory.glob('*.receipts.json'), *directory.glob('*.verification.json')])
        if members:
            manifest = [{'file': p.name, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in members]
            with tarfile.open(directory / 'receipts-and-verifications.tar.gz', 'w:gz') as archive:
                for p in members:
                    archive.add(p, arcname=p.name)
            (directory / 'receipt-members.json').write_text(json.dumps(manifest, indent=2) + '\n')
            # Reversible packaging: original receipts retained outside the repository.
            retained = pathlib.Path('/tmp/p1-threshold-private/raw-receipts') / directory.name
            retained.mkdir(parents=True, exist_ok=True)
            for p in members:
                p.replace(retained / p.name)
(OUT / 'sweep-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
lines = ['| Threshold | Bank | Buy-and-cite | answersIt | negativeBuys | Spend minor | Gate violations | Online |',
         '|---:|---|---:|---:|---:|---:|---:|---:|']
def ratio(value):
    return f"{value['n']}/{value['N']}"
for row in summary:
    if 'buyAndCite' not in row:
        lines.append(f"| {row['threshold']} | {row['bank']} | failed before results | — | — | — | — | — |")
        continue
    lines.append(f"| {row['threshold']} | {row['bank']} | {ratio(row['buyAndCite'])} | {ratio(row['answersIt'])} | {ratio(row['negativeBuys'])} | {row['spentMinor']} | {row['gateViolations']} | {ratio(row['onlineVerification'])} |")
(OUT / 'sweep-table.md').write_text('\n'.join(lines) + '\n')
print('\n'.join(lines))
