# The Handover

Live prototype: https://handingover.netlify.app

An AI-led interview that helps someone record what the people they leave behind will need to know: who to call, what exists, where it is, and what must not be missed. A short opening conversation produces a plan of short sessions, one area each. What's said during them is written into a printable **Guide**, plus a **Sealed Envelope** for anything meant to be read only after death. It is not a will and gives no legal, financial, tax or medical advice.

A Vibrance product exploration, built by Jack with Santi, with Pete and Sahil overseeing. **Prototype.** For why things are built the way they are, see [docs/Design Notes.md](docs/Design%20Notes.md).

> Naming: the code and database say **sitting**; everything a person sees says **session**. The repo and folder still use the old codename, `deadmansdoc`.

## Running it

Node 20.6+. Copy [`.env.example`](.env.example) to `.env.local` and fill it in. Each variable is explained in that file.

```bash
npm install
npm run migrate   # applies db/migrations/*.sql once each
npm run dev       # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests (vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Production build. **Also validates everything in `data/`** and fails with a message naming the problem |
| `npm run make-admin -- you@example.com` | Makes an account an admin (`--remove` to undo). Needed once on a fresh database |
| `node scripts/e2e-*.mjs` | Browser checks against a running server. Some talk to the real model and spend API credit — see [Design Notes](docs/Design%20Notes.md#local-setup) for which |

Point `.env.local` at the Neon **dev** branch for feature work, not production.

## How it fits together

```
data/*.yaml ──▶ src/lib/content.ts (loads + cross-checks at build)
                    │
   opening conversation ─▶ plan ─▶ sessions ─▶ record (Postgres) ─▶ Guide + Sealed Envelope
   src/lib/intake         src/lib/plan  src/lib/sitting               src/lib/artifact
```

- **Next.js App Router + TypeScript + Tailwind**, hosted on Netlify. Signed-in pages are in `src/app/(app)/`, public ones in `src/app/(public)/`.
- **Neon Postgres.** Plain SQL migrations in [`db/migrations/`](db/migrations).
- **Claude** is the only external service. The model is set in one place, [`src/lib/model.ts`](src/lib/model.ts).
- **Better Auth** for email and password accounts, with sign-up gated by a shared access code.
- The **conversations** run in [`src/lib/intake/`](src/lib/intake) (opening) and [`src/lib/sitting/`](src/lib/sitting) (sessions). Each has a `prompt.ts` (what the model is told) and an `agent.ts` (the turn loop and tools).
- The **plan** is worked out in code from the opening conversation, not by the model.
- The **Guide and Envelope** are rendered from stored data, so the same record always prints the same document.

## Changing what it asks and records

Most changes are YAML edits in [`data/`](data), not code changes. The build checks the files against each other, so a mistake fails `npm run build` instead of shipping.

| To change… | Edit | Notes |
|---|---|---|
| **The sessions**: their names, what each covers, how long, the topics shown to people | [`data/session-template.yaml`](data/session-template.yaml) | Every field must be covered by exactly one session, and belong to exactly one of that session's topics. `rules` adjust the time estimate from what the opening conversation learned |
| **What the record holds**: sections, fields, open, sealed or pointer | [`data/artifact-fields.yaml`](data/artifact-fields.yaml) | Field ids are stored in the database, so **add a field rather than rename one**. The model's recording tools are generated from this file |
| **The questions** | [`data/question-bank.yaml`](data/question-bank.yaml) | `ask` is a starting phrasing, not a script. `fills` names the fields a question can fill. `priority` and `rank` decide what the model is nudged towards next |
| **"Your family would know…" progress claims** | [`data/milestones.yaml`](data/milestones.yaml) | Each one names the fields that must all hold an answer before it can be claimed |
| **Demo people** | [`data/personas/`](data/personas) | Invented people, used for seeding and for the scripted demo |
| **How the AI talks** | `src/lib/intake/prompt.ts`, `src/lib/sitting/prompt.ts` | Tone, hard rules (no advice, never ask for passwords or account numbers), and "always end on a question" |
| **The Guide's layout** | [`docs/Artifact Template.md`](docs/Artifact%20Template.md), then `src/lib/artifact/render.ts` | The template lists all 14 sections. Sections 1, 2, 3 and 5 are built |

A worked example is in [docs/Section Regroup Proposal.md](docs/Section%20Regroup%20Proposal.md), which plans a regroup into four sessions including a new Life admin session.

## Accounts, admins and demos

- Sign-up needs the `SIGNUP_ACCESS_CODE`. No email is sent or checked, and there's no password reset yet.
- **Admins** see every account, every record and transcript, and an error log at `/admin`. Admins can make other admins there.
- **`/admin/demo`** has three ways to show the product:
  1. **Accounts to hand out.** Three fixed accounts (not started, half way, finished) with one password you choose. Set them up again after each person to reset them.
  2. **Seed a persona** into any account. Instant and free.
  3. **Watch one being made.** A scripted run through the real AI, about 10 minutes and about US$0.50.

## Data and privacy, as of now

- Testers are told on sign-up and at the start not to enter passwords, PINs or account numbers, and that the team can read what's typed. The AI is told never to ask for them, and refuses them if offered.
- **Admins can read every record.** That's acceptable while the data is made up. It needs a decision before real people's details go in. Open items: row-level security or encryption in Neon, a review of the auth setup, backups, and who has admin.
- Figures (balances, amounts) are kept out of the Guide and print only in the Sealed Envelope. This shows the idea working; it isn't real security.

## Deploying

Netlify builds every push to `main` ([`netlify.toml`](netlify.toml)) and builds a preview for each pull request. It needs `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SIGNUP_ACCESS_CODE` and `ANTHROPIC_API_KEY`. Leave `BETTER_AUTH_URL` unset there. Before merging a branch that adds a migration, run `npm run migrate` against production.

## Further reading

- [docs/Design Notes.md](docs/Design%20Notes.md): the full design history, measurements and known debts
- [docs/Walkthrough Feedback Plan 2026-10-08.md](docs/Walkthrough%20Feedback%20Plan%202026-10-08.md): the current round of work
- [docs/Artifact Template.md](docs/Artifact%20Template.md): what the finished document contains
- `docs/Questions/`: the original 167-question brainstorm the question bank was narrowed from
