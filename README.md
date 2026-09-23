# The Handover

Live prototype: https://handingover.netlify.app

_Renamed on 2026-09-17 from an internal codename that was too blunt for a product about death. "The Handover" was already taken on Netlify, so the project there is `handingover`. The GitHub repo and local folder still use the old name, `deadmansdoc`, for now._

An AI-led interview that helps someone record what the people they leave behind will actually need to know — who to call, what exists, where it is, and what must not be missed. The output is a single printable document.

A Vibrance product exploration, led by Jack with Santi, under oversight from Pete and Sahil. **Currently in prototype.**

## What this is

- An **AI interviewer** that draws the information out, rather than a form the user fills in.
- It captures knowledge, responsibilities, processes, contacts, and locations — the everyday things a family needs that a will doesn't cover.
- It surfaces **unknown unknowns**: things the user wouldn't think to record unless asked.
- It points to existing tools (password managers, document storage) rather than replacing them.

### Not a will

| | Will | The Handover |
|---|---|---|
| Nature | Legal document | Practical handover & instruction record |
| Covers | Distribution of assets, estate, guardianship | Knowledge, processes, contacts, locations, instructions |
| Answers | What happens, who is legally entitled | What needs doing, how things work, where things are, who to call |

> A will determines what happens to your estate. This explains what the people you leave behind need to know and do.

This product has **no testamentary effect** and never gives legal, financial, tax, or medical advice. It can tell you what to ask and who to ask — never what the answer is.

## How it works

### Two people, one session

The core insight from discovery is that this is too confronting and too large for one person to face alone. The intended use is a **parent and an adult child sitting down together**, with the AI conducting the interview and the child helping to facilitate it. Equally, the child can use it as the thing that finally starts the conversation.

Practically: **one account per record, one device, no second login.** Who was present is recorded as part of the session.

### The interview

The AI conducts a largely free-form conversation, using the question bank as a coverage checklist rather than a script. The value is in handling how people actually talk — a rambling, roundabout answer often contains information spanning several domains at once. The agent is expected to ingest that, map it to whatever fields it satisfies, and choose follow-ups that probe deeper where something interesting surfaced.

### The session plan

The process is too long for one sitting, so it's deliberately broken up. A short opening questionnaire captures a high-level picture, and the system returns a plan of sessions with time estimates — intended to make a large, intimidating task feel finite.

The **set of domains is the same for every user**. What varies per user:

- **Estimated time per domain** — someone with one sibling and someone with five get different estimates for the same domain.
- **Order of domains** — if something came up unprompted in the opening questions, it's already front of mind, and that's a signal to do it first.

### The artifact

The finished output is a **printable document**, structured on the client's draft Family Guide. Discovery found that a physical piece of paper has genuine value here; the product does not need to be technically sophisticated to be worth having.

One record produces **two printed artifacts**: the Guide, which the family can read at any time, and a Sealed Envelope, printed separately and opened only after death. That is how asymmetric disclosure works here — a physical seal, rather than a server deciding when to release something. Every field is Open, Sealed, or a Pointer that records where a secret lives without ever printing the secret itself.

The interview exists to fill the fields of that template. Locking the template down is therefore what makes the interview buildable. See [Artifact Template](docs/Artifact%20Template.md).

## Decisions locked

| Area | Decision |
|---|---|
| Runtime | Node.js |
| Hosting | Netlify (production deploys already wired to this repo) |
| Database | Neon Postgres. Production branch for the live site; a `dev` branch for feature work |
| Auth | Better Auth in-app, email + password, sign-up gated by a shared access code |
| Fidelity | Prototype-first, but **not throwaway** — built to be iterated toward production |
| Accounts | One account per record; no second participant login |
| Interview | Free-form AI conversation; question bank as coverage checklist |
| Session plan | Fixed template of sittings, filtered per user for time and order |
| Opening conversation | Claude Opus 5, streamed, with tools that record a rough picture |
| Artifact structure | Lifted from the client's draft Family Guide |
| Artifact output | Markdown or Word for MVP — no designed PDF yet |
| Asymmetric disclosure | In scope for the demo; **demonstrated, not genuinely secure**. Two printed documents, split per field |
| Trigger event | Death only. Incapacity is a known, accepted gap |
| Death trigger / ADNS | Dropped — the artifact is physical, so no digital release trigger is needed |
| Consent | Consent and who was present are captured |
| Jurisdiction | Victoria only; built to be correct within Victoria |

## Local setup

Requires Node 20.6 or later (the migration script uses the built-in `--env-file`).

```bash
cp .env.example .env.local   # then fill in from the Neon dashboard
npm install
npm run migrate
```

`DATABASE_URL` is Neon's **pooled** connection, used by the app. `DATABASE_URL_UNPOOLED` is the **direct** one, used only by migrations — DDL over a pooled connection is unreliable.

Migrations are plain SQL in [`db/migrations/`](db/migrations), applied in filename order and recorded in a `_migrations` table, so re-running is safe.

For feature work, point `.env.local` at the Neon **dev** branch rather than production; migrations reach production only when a branch is about to merge.

```bash
npm run dev      # http://localhost:3000
npm run build    # also validates data/ — see below
npm run lint
npm test         # unit tests (vitest)
scripts/e2e-auth.sh           # auth checks against a running server
node scripts/e2e-intake.mjs   # full browser journey (spends API credit)
```

`GET /api/health` reports whether the database is reachable and which content version is loaded.

`scripts/e2e-intake.mjs` drives a real browser through sign-up, the opening conversation and the plan, using a synthetic persona. It calls the real Claude API (about US$0.10–0.15 a run) and needs `npx playwright install chromium --only-shell` once. Both scripts create `…@example.test` accounts; delete them afterwards.

`scripts/e2e-auth.sh` expects a server on `http://localhost:3000` (`npm run build && npm start`, or `netlify serve --offline --port 3000`) and the dev database. It creates `…@example.test` accounts; delete them afterwards. It pauses between groups of requests to stay under the sign-in rate limit, so it takes about a minute.

## Accounts and access

Auth is [Better Auth](https://www.better-auth.com), configured in [`src/lib/auth.ts`](src/lib/auth.ts), with its tables in our own database ([`db/migrations/002_auth.sql`](db/migrations/002_auth.sql)).

- **Sign-up is invite-only.** The form asks for an access code, sent as the `x-signup-code` header and checked on the server against `SIGNUP_ACCESS_CODE`. If that variable is unset, nobody can sign up. Failed attempts count towards the rate limit, so guessing codes is slow.
- **Email and password**, minimum 10 characters. There's no password reset yet; that needs an email provider.
- **Rate limiting** is stored in the database, since in-memory counters reset on every serverless cold start. Sign-in and sign-up allow 3 attempts per 10 seconds per IP.
- **Public:** `/`, `/sign-in`, `/sign-up`, `/api/health`, `/api/auth/*`. **Everything else requires a session.**
- [`src/proxy.ts`](src/proxy.ts) only checks that a session cookie *exists* and redirects early if not. The real check is `requireSession()` in [`src/lib/session.ts`](src/lib/session.ts); every protected layout, route handler and server action must call it. Pages under [`src/app/(app)/`](src/app/(app)) get it from their shared layout.

Regenerate the auth tables with `npx auth@<better-auth version> generate --config src/lib/auth.ts` if the auth config gains plugins or fields, and add the result as a new migration.

### Deploying

Netlify builds on every push to `main` ([`netlify.toml`](netlify.toml)), and builds a deploy preview for each pull request. The running site needs these environment variables:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Pooled Neon connection. Production uses the production branch; previews should use `dev`. |
| `BETTER_AUTH_SECRET` | Random, 32+ characters. Without it, auth refuses to run in production. Changing it signs everyone out. |
| `SIGNUP_ACCESS_CODE` | The invite code. Unset means sign-up is closed. |
| `ANTHROPIC_API_KEY` | For the opening conversation. Without it that page errors; the rest of the site is fine. |

Leave `BETTER_AUTH_URL` **unset** on Netlify. The app then accepts requests for `handingover.netlify.app` and its `*--handingover.netlify.app` previews and rejects any other host.

The build itself needs no secrets, though without `BETTER_AUTH_SECRET` in the build environment Better Auth logs a harmless "default secret" error while pages are prepared.

Before merging a branch that adds a migration, apply it to production with `npm run migrate` using the production `DATABASE_URL_UNPOOLED`.

## The opening conversation and the plan

A new account goes `/start` → `/start/intake` → `/plan/new` → `/plan`; `/home` sends people to whichever step they're up to.

**Starting** ([`src/app/(app)/start`](src/app/(app)/start)) records who the handover is for, who's in the room, and consent, including an acknowledgement that this isn't a will.

**The conversation** ([`src/lib/intake`](src/lib/intake)) is Claude Opus 5, streamed to the browser as newline-delimited JSON. It has two tools: `record_intake` stores a rough picture (counts, yes/no, and which topics were raised unprompted), and `finish_intake` ends it.

- The model writes its reply **before** calling a tool, so a turn is normally one API call. About US$0.11 for a whole conversation.
- The system prompt is fixed for everyone so it caches; per-person details go in a context block at the start of the conversation, fixed for its lifetime.
- Limits: 12 exchanges (after which the server finishes the conversation regardless), 2,000 characters a message, one reply at a time per record, and three model calls a turn.
- Tool input is validated against the zod schema in [`signals.ts`](src/lib/intake/signals.ts), which also generates the tool's JSON Schema. A failure goes back to the model as a tool error rather than being stored.
- A person's message is only saved once the model has replied, so a failed call leaves nothing behind and can simply be sent again.
- Every model call logs its token usage as `intake_model_call`.

**The plan** ([`src/lib/plan/build-plan.ts`](src/lib/plan/build-plan.ts)) is worked out in code, not by the model. [`data/session-template.yaml`](data/session-template.yaml) holds the sittings, their base minutes and the rules that adjust them; tune it there rather than in code. Order follows whatever was raised unprompted, then the template's own order. Sittings over 30 minutes split into parts. The build fails unless every v1 field is covered by exactly one sitting.

## Repo structure

[`data/`](data) holds the product's core data assets — the artifact field definitions and the question bank that fills them. Everything else reads from these.

They're loaded and cross-checked in [`src/lib/content.ts`](src/lib/content.ts). A question pointing at a field that doesn't exist, or a field with no question to fill it, **fails the build** with a message naming the problem. The database stores these ids as plain text and can't catch the mistake itself.

[`src/`](src) is the Next.js app (App Router, TypeScript, Tailwind). Public pages live in `src/app/(public)/`, signed-in pages in `src/app/(app)/`. [`db/`](db) holds migrations; [`scripts/`](scripts) holds test tooling. `AGENTS.md` and `CLAUDE.md` are generated by Next.js and re-added by `next dev`; they're committed deliberately.

Project material lives under [`docs/`](docs) — this repo is the official record, superseding the original Obsidian vault.

- **`01. Initial Docs/`** — the client's original project brief. The client's draft Family Guide sits here as the reference for what the finished artifact should feel like, but it contains real personal and financial detail and is **excluded from version control**.
- **`Questions/`** — the question bank: 167 files, one question each, tagged by domain. Deliberately over-broad; generated in a wide brainstorm and expected to be whittled down.
- **`Question Brainstorming/`** — framing techniques and the slimming-down criteria (irreplaceability, decay, generativity), plus the original single-file draft.
- **`Core System Specification Notes.md`** — what the system is, and how it differs from a will.
- **`Initial Competitor Research Scan Takeaways.md`** — market scan and positioning notes.
- **`Potential Use Case's for Demonstration.md`** — early feature and demo ideas.
- Story map and logic-branching sketches — **working drafts, not specifications**. Useful for direction only.

## Roadmap

**Done**

- [Artifact template](docs/Artifact%20Template.md) — all 14 sections mapped; **Sections 1, 2, 3 and 5 are the v1 build scope**.
- [Artifact fields](data/artifact-fields.yaml) and [question bank](data/question-bank.yaml) — v1 fields given stable ids, and the bank narrowed and mapped onto them.
- [Schema](db/migrations/001_init.sql) — records, sittings, messages, entities and field values.
- Next.js app, content loader validating `data/`, database client and health check, deployed to Netlify.
- Accounts: sign-up with an access code, sign-in, sign-out, and protected pages.
- The opening conversation and the plan of sittings.

**Next**

- The conversation for each sitting: the real interview, filling the artifact fields.
- Printing the Guide and the Sealed Envelope.

**Later**

- **Split-screen live artifact view** — chat on one side, the document updating in real time on the other. A core centrepiece of the intended UX, but dependent on the template being fixed first.
- **Synthetic personas and DB seeding** — we generate our own rather than waiting on the client, and demo against them. No real personal data enters the prototype.
- Richer progress feedback and gamification.
- Designed, styled PDF output.
- Password reset and email verification (needs an email provider).
- Second participant on their own device.
- Genuinely secure asymmetric disclosure.
- Jurisdictions beyond Victoria.

## Guardrails

- No legal, financial, tax, or medical advice — designed in, not bolted on as a disclaimer.
- No real personal data in the prototype; synthetic personas only.
- Tone matters more than anything else here. This is a product about death, used by people who are grieving or frightened. Anything glib or clinical fails.

## Notes

Santi works in parallel on his own fork. Work items are not tracked in this repo.
