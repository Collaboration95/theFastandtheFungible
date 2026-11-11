# Judge-pack release checks, 11 Nov 2026

XRPL Testnet only, no real value. Packages downloaded from the published v1.1.1
GitHub release using authenticated `gh release download`. No live hosted question,
cloud change, site publication or hosted screenshot refresh was performed.

- MCP package SHA-256: `218a96b9bfe7c8b788d357bd6939160dadeaa9e5f409b98e8a34e802b292a56e`.
- `try-output.txt`: published package, fresh isolated state, ephemeral ports,
  fixture research and decision models, fictional and team-authored writers,
  faucet-funded wallets. Six validated Testnet transactions: buy, writer-signed
  refund, re-buy, anchor. RESULT PASS in 59.2 s, ledger 12/12; budget S$2.00,
  gross S$0.70, net S$0.40 (labelled demo equivalents). This is a single run;
  the historic cold npm-cache timing and its misses remain unchanged.
- `verify-python.txt`: published v1.1.1 wheel installed with `--no-index` into
  an empty venv; `researchagent verify docs/evidence/hosted-export-nov11/receipts.json
  --ledger`. Read-only public Testnet lookups: 46 passed, 0 failed, 2 skipped,
  anchor ledger 22228575, ledger 11/11, RESULT PASS. The input is the committed
  earlier hosted export, not a new v1.1.1 hosted answer. Skipped is not failed;
  verification does not prove writer identity or source accuracy.
- `node scripts/check-release-urls.mjs`: 22 pinned URLs passed. Public release
  and asset URLs are resolved through authenticated `gh` and HEAD-checked at
  their release, asset or tagged-file endpoints. No release bodies are fetched.
- `npm run site:progress -- --at origin/main` and `node scripts/facts.mjs`:
  snapshot at `bd52beff`, 270 main PRs since 21 Sep, 15 published releases,
  latest v1.1.1; historic measurements keep their own dates and labels.
- Deck export: 14 pages; no missing images, stale markers, placeholders or
  detected frame overflow. All PDF pages rendered for visual inspection.
  Slide 3 shows the full new CLI output with transaction links shortened;
  slide 7 shows the published wheel's actual verification output.

The hosted slide-10 images and README hero retain their existing capture
manifest. The orchestrator must run the final `--refresh-shots` only after
redeploy, within the hosted question allowance, then export and publish the site.
The recorded video's Claude MCP scene still needs the optional v1.1.1 re-record;
voice, upload, team name and submission remain owner items in issue #265.

## Routed claim audit, second resume

Checked all 18 assigned rows against the resumed branch and `origin/main`
at `bd52beff`. Row IDs refer to the sprint's story review section 1.4 and
XRPL review section 5. The submission-form recommendations in story section 4
are reflected in `short-description.md` and the submission README.

| List / row | Result and checked surface |
|---|---|
| Story 1 | Release-link checker uses authenticated `gh`, HEAD-checks pinned endpoints and blocks `site-publish.py` before publication; missing assets fail its tests. |
| Story 4 | README and deck slide 1 lead with payment by key reveal; the policy explanation names fixed rules in the sandbox. |
| Story 5 | Video script, source shots and generated voiceover say fixed rules here; captions and timing agree. |
| Story 6 | Video close says writers are paid on delivery and anyone can check the ledger. No open-market or quality-enforcement claim. |
| Story 7 | Pitch close and deck slide 14 say every payment has a Testnet hash. |
| Story 8 | Deck slides 2 and 7, pitch and Q&A say the two verifiers were written separately. |
| Story 9 | Long description qualifies purchases by policy judgement; the recommended 150-word form follows story section 4. |
| Story 11 | Slide 8 notes use the generated sixteen/twenty markers and include the 7/20 lead rate. |
| Story 12 | Facts and deck slides 1–3 and 14 pin v1.1.1; slide 3 reproduces its fresh package run and honest skipped-check wording. |
| Story 13 | Pitch and slide 4 scope zero violations to the Testnet blind banks; simulated historical audits retain their labels. |
| Story 14 | Spoken pitch uses the refusal beat; slide 8 keeps 16/20 bought-and-cited and 7/20 key-fact leads together. |
| Story 15 | Site home distinguishes live answers / rule-based buying / team-authored writers from the fixture-model, fictional-writer replay. |
| XRPL 1 | Q&A 14 limits Credentials to CLI-published writers and calls sandbox team writers unverified. |
| XRPL 2 | Compliance slide and deck say publish CLI; none in the live sandbox. |
| XRPL 4 | README, numbers, descriptions, pitch, Q&A and deck attribute 12 drops to buyer create and 423 to writer finish; Q&A and numbers distinguish the 360-drop protocol minimum. |
| XRPL 6 | Deck slides 6 and 11 and Q&A say TokenEscrow is enabled on Testnet and Mainnet; issuer flags block RLUSD. |
| XRPL 7 | README, description, Q&A and deck distinguish CLI/token evidence from sandbox XRP. |
| XRPL 10 | No positive claim to unused ledger features, mainnet readiness, KYC or smart contracts. The compliance slide explicitly denies unsupported capabilities. |

XRPL rows 3 and 5 remain with X1. Team names are unchanged. Public text has
no private review scores. The held-out result retains fixture research and
decision models, offline-written answers, Testnet and the once-only run date.
The long description's off-topic sentence now correctly says it bought nothing
on ten questions, rather than saying it bought nothing on zero of ten.
