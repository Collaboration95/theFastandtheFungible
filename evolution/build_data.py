#!/usr/bin/env python3
"""Build evolution/data.js: the numbers behind the evolution page.

Inputs: the project's git history, its GitHub pull requests, issues and CI runs
(via the gh CLI), and agents.json, an aggregate of the Codex and Claude Code
logs (prompt counts, token counters, tool calls; no prompt or reply text).

    python3 evolution/build_data.py <repo checkout> <agents.json>
"""
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import re
import subprocess
import sys

SGT = timezone(timedelta(hours=8))
FIRST_DAY, LAST_DAY = '2026-09-03', '2026-10-11'
OUT = Path(__file__).resolve().parent / 'data.js'

AREAS = [  # (key, label, top-level paths); anything unlisted counts as infra
    ('ui', 'App UI', ('src', 'index.html', 'vite.config.ts')),
    ('agent', 'Agent & server', ('server', 'shared')),
    ('sites', "Writers' sites", ('publisher', 'Dockerfile.publisher')),
    ('tests', 'Tests & evals', ('tests', 'eval', 'playwright.config.ts', 'vitest.config.ts')),
    ('design', 'Design & prototypes', ('prototypes', 'ui-overhaul', 'diagrams', 'canvas', 'screenshots', 'assets',
                                       'design', 'design-skills', 'talk', 'reference')),
    ('docs', 'Docs & plans', ('docs', 'final-push', 'research')),
    ('data', 'Corpus & data', ('data',)),
    ('ops', 'Scripts & infra', ()),
]
# Third-party hackathon starter repos and generated files are not the project's own lines.
SKIP = re.compile(r'(^(ripple|juliusbaer)-singhacks/|package-lock\.json$|\.tsbuildinfo$)')
TEST_CALL = re.compile(rb'^\s*(?:it|test)(?:\.each\([^)]*\))?\s*\(', re.M)


def git(repo, *args, data=None):
    return subprocess.run(['git', '-C', repo, *args], input=data, capture_output=True, check=True).stdout


def gh(repo, *args):
    return json.loads(subprocess.run(['gh', *args], cwd=repo, capture_output=True, check=True, text=True).stdout)


def area_of(path):
    top = path.split('/', 1)[0]
    for key, _, tops in AREAS:
        if top in tops:
            return key
    return 'docs' if '/' not in path and path.endswith(('.md', '.txt')) else 'ops'


def sgt(ts):
    return datetime.fromtimestamp(ts, SGT)


def days():
    d = datetime.fromisoformat(FIRST_DAY)
    while d.strftime('%Y-%m-%d') <= LAST_DAY:
        yield d.strftime('%Y-%m-%d')
        d += timedelta(days=1)


def iso_ts(s):
    return int(datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()) if s else None


def commits(repo):
    """Every non-merge commit on a local or remote branch, once, with lines added and deleted per area."""
    raw = git(repo, 'log', '--branches', '--remotes', '--no-merges', '--numstat', '--format=@%H %ct %P').decode('utf-8', 'replace')
    main = set(git(repo, 'rev-list', '--first-parent', 'origin/main').decode().split())
    out, cur = [], None
    for line in raw.splitlines():
        if line.startswith('@'):
            sha, ts, *_ = line[1:].split()
            cur = dict(sha=sha, ts=int(ts), add=0, dele=0, by=Counter(), main=sha in main)
            out.append(cur)
        elif line.strip() and cur is not None:
            a, d, path = line.split('\t', 2)
            if a == '-' or SKIP.search(path):
                continue
            cur['add'] += int(a)
            cur['dele'] += int(d)
            cur['by'][area_of(path.split(' => ')[-1].strip('{}'))] += int(a) + int(d)
    out.sort(key=lambda c: c['ts'])
    return [[c['ts'], c['add'], c['dele'], (c['by'].most_common(1) or [('ops', 0)])[0][0], int(c['main'])] for c in out]


def tree_lines(repo, sha):
    """Lines and tests in the tree at one commit, by area."""
    entries = [l.split('\t', 1) for l in git(repo, 'ls-tree', '-r', sha).decode().splitlines()]
    blobs = [(meta.split()[2], path) for meta, path in entries if meta.split()[1] == 'blob' and not SKIP.search(path)]
    batch = git(repo, 'cat-file', '--batch', data=''.join(b + '\n' for b, _ in blobs).encode())
    lines, tests, files, i = Counter(), 0, Counter(), 0
    for _, path in blobs:
        header_end = batch.index(b'\n', i)
        size = int(batch[i:header_end].split()[2])
        body = batch[header_end + 1: header_end + 1 + size]
        i = header_end + 2 + size
        if b'\0' in body[:8000]:
            continue
        key = area_of(path)
        lines[key] += body.count(b'\n')
        files[key] += 1
        if re.search(r'\.(test|spec)\.[cm]?[jt]sx?$', path):
            tests += len(TEST_CALL.findall(body))
    return lines, tests, files


def snapshots(repo):
    """Main at the end of each Singapore day."""
    log = [l.split() for l in git(repo, 'log', '--first-parent', '--format=%H %ct', 'origin/main').decode().splitlines()]
    log = [(sha, int(ts)) for sha, ts in reversed(log)]
    out, last = [], None
    for day in days():
        end = datetime.fromisoformat(day).replace(tzinfo=SGT) + timedelta(days=1)
        at = [sha for sha, ts in log if ts < end.timestamp()]
        if not at:
            continue
        if at[-1] != last:
            lines, tests, files = tree_lines(repo, at[-1])
            last, row = at[-1], [day, {k: lines[k] for k, *_ in AREAS}, tests, sum(files.values())]
        else:
            row = [day, *out[-1][1:]]
        out.append(row)
    return out


def main(repo, agents_path):
    agents = json.loads(Path(agents_path).read_text())
    prs = gh(repo, 'pr', 'list', '--state', 'merged', '--limit', '500',
             '--json', 'number,title,createdAt,mergedAt,additions,deletions,changedFiles')
    issues = gh(repo, 'issue', 'list', '--state', 'all', '--limit', '1000', '--json', 'number,createdAt,closedAt')
    runs = gh(repo, 'run', 'list', '--workflow', 'ci', '--limit', '1000', '--json', 'createdAt,updatedAt,conclusion,event')
    prs.sort(key=lambda p: p['mergedAt'])
    data = dict(
        generated_at=datetime.now(SGT).isoformat(timespec='minutes'),
        first_day=FIRST_DAY, last_day=LAST_DAY,
        areas=[[k, label] for k, label, _ in AREAS],
        commits=commits(repo),
        snapshots=snapshots(repo),
        prs=[[p['number'], iso_ts(p['createdAt']), iso_ts(p['mergedAt']), p['additions'], p['deletions'], p['changedFiles'], p['title']] for p in prs],
        issues=sorted([[iso_ts(i['createdAt']), iso_ts(i['closedAt'])] for i in issues]),
        ci=sorted([[iso_ts(r['createdAt']), iso_ts(r['updatedAt']) - iso_ts(r['createdAt']), r['conclusion'] == 'success'] for r in runs if r['conclusion']]),
        agents=agents,
    )
    OUT.write_text('/* Generated by build_data.py; do not edit. */\nwindow.EVO = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')
    print(f"{OUT.name}: {OUT.stat().st_size // 1024} KB, {len(data['commits'])} commits, {len(prs)} PRs, {len(issues)} issues, {len(data['ci'])} CI runs")


if __name__ == '__main__':
    main(*sys.argv[1:3])
