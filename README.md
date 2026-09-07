# tftf

tftf is the repository for ResearchAgent, a SingHacks 2026 Ripple/XRPL-track
prototype that helps a researcher decide which evidence is worth buying.

## Active project

- [ResearchAgent](prototypes/ResearchAgent/README.md) — local setup, demo flow,
  API overview, and current product status.

## Documentation

The active product contracts and archived hackathon material are indexed in
[the ResearchAgent documentation index](prototypes/ResearchAgent/docs/README.md).

## Quick start

```bash
cd prototypes/ResearchAgent
npm install
cp .env.example .env
npm run dev
```

Open <http://localhost:5173>. The default fixture mode requires no credentials
and does not make a real publisher payment.
