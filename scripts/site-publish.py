#!/usr/bin/env python3
"""Publish main's static site over gh-pages without deleting branch-only files."""
import hashlib
import json
import pathlib
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parent.parent

def git(*args, cwd=root, check=True):
    return subprocess.run(['git', *args], cwd=cwd, check=check, stdout=subprocess.PIPE).stdout

def digest(data):
    return hashlib.sha256(data).hexdigest()

if git('status', '--porcelain', '--', 'site'):
    raise SystemExit('site/ has uncommitted changes; commit them first')
subprocess.run(['npm', 'run', 'build:demo'], cwd=root, check=True)
git('fetch', 'origin', 'gh-pages')
files = [p for p in (root / 'site').rglob('*') if p.is_file() and p.relative_to(root / 'site').as_posix() not in ('SOURCE.md', 'evolution/data.js')]
with tempfile.TemporaryDirectory(prefix='site-publish-') as temp:
    work = pathlib.Path(temp) / 'pages'
    git('worktree', 'add', '--detach', str(work), 'origin/gh-pages')
    try:
        manifest = work / '.site-publish.json'
        old = json.loads(manifest.read_text()) if manifest.exists() else {}
        new = {}
        for src in files:
            rel = src.relative_to(root / 'site').as_posix()
            dst = work / rel
            desired = src.read_bytes()
            if dst.exists() and dst.read_bytes() != desired:
                if rel in old:
                    expected = old[rel]
                else:
                    base = subprocess.run(['git', 'show', f'6f700388548282691251c0a7b40bb1c8c8b55153:{rel}'], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                    expected = digest(base.stdout) if base.returncode == 0 else None
                if digest(dst.read_bytes()) != expected:
                    raise SystemExit(f'Conflict: {rel} changed on gh-pages; reconcile before publishing')
            new[rel] = digest(desired)
        for src in files:
            dst = work / src.relative_to(root / 'site')
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())
        manifest.write_text(json.dumps(new, indent=2, sort_keys=True) + '\n')
        git('add', '-A', cwd=work)
        if subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=work).returncode:
            git('commit', '-m', 'Publish explainers site', cwd=work)
            print('Publishing', git('rev-parse', 'HEAD', cwd=work).decode().strip(), flush=True)
            subprocess.run(['git', 'push', 'origin', 'HEAD:gh-pages'], cwd=work, check=True)
        else:
            print('Pages already up to date')
    finally:
        git('worktree', 'remove', '--force', str(work))
