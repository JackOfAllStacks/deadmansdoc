# Dead Man's Doc

_Working title in the client brief: **The Handover**._

An AI-led interview that helps someone record what the people they leave behind will actually need to know — who to call, what exists, where it is, and what must not be missed. The output is a single printable document.

A Vibrance product exploration, led by Jack with Santi, under oversight from Pete and Sahil. **Currently in prototype.**

## What this is

- An **AI interviewer** that draws the information out, rather than a form the user fills in.
- It captures knowledge, responsibilities, processes, contacts, and locations — the everyday things a family needs that a will doesn't cover.
- It surfaces **unknown unknowns**: things the user wouldn't think to record unless asked.
- It points to existing tools (password managers, document storage) rather than replacing them.

### Not a will

| | Will | Dead Man's Doc |
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
| Database | Neon Postgres (created; not yet connected) |
| Fidelity | Prototype-first, but **not throwaway** — built to be iterated toward production |
| Accounts | One account per record; no second participant login |
| Interview | Free-form AI conversation; question bank as coverage checklist |
| Session plan | Fixed domain template, filtered per user for time and order |
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

```bash
npm run dev      # http://localhost:3000
npm run build    # also validates data/ — see below
npm run lint
```

`GET /api/health` reports whether the database is reachable and which content version is loaded.

### Deploying

Netlify builds on every push to `main` ([`netlify.toml`](netlify.toml)). The build needs no secrets; the running site needs `DATABASE_URL` set in Netlify's environment variables (pooled connection, scoped to Functions). Until it is, pages render but anything touching the database fails.

## Repo structure

[`data/`](data) holds the product's core data assets — the artifact field definitions and the question bank that fills them. Everything else reads from these.

They're loaded and cross-checked in [`src/lib/content.ts`](src/lib/content.ts). A question pointing at a field that doesn't exist, or a field with no question to fill it, **fails the build** with a message naming the problem. The database stores these ids as plain text and can't catch the mistake itself.

[`src/`](src) is the Next.js app (App Router, TypeScript, Tailwind). [`db/`](db) holds migrations. `AGENTS.md` and `CLAUDE.md` are generated by Next.js and re-added by `next dev`; they're committed deliberately.

Project material lives under [`docs/`](docs) — this repo is the official record, superseding the original Obsidian vault.

- **`01. Initial Docs/`** — the client's original project brief. The client's draft Family Guide sits here as the reference for what the finished artifact should feel like, but it contains real personal and financial detail and is **excluded from version control**.
- **`Questions/`** — the question bank: 167 files, one question each, tagged by domain. Deliberately over-broad; generated in a wide brainstorm and expected to be whittled down.
- **`Question Brainstorming/`** — framing techniques and the slimming-down criteria (irreplaceability, decay, generativity), plus the original single-file draft.
- **`Core System Specification Notes.md`** — what the system is, and how it differs from a will.
- **`Initial Competitor Research Scan Takeaways.md`** — market scan and positioning notes.
- **`Potential Use Case's for Demonstration.md`** — early feature and demo ideas.
- Story map and logic-branching sketches — **working drafts, not specifications**. Useful for direction only.

## Roadmap

**Next**

- [Artifact template](docs/Artifact%20Template.md) — all 14 sections mapped; **Sections 1, 2, 3 and 5 are the v1 build scope**.
- [Artifact fields](data/artifact-fields.yaml) and [question bank](data/question-bank.yaml) — v1 fields given stable ids, and the bank narrowed and mapped onto them.
- [Schema](db/migrations/001_init.sql) — records, sessions, messages, entities and field values. Applied to Neon.
- Next.js app scaffolded, content loader validating `data/`, database client and health check.
- The opening questionnaire and generated session plan.
- The interview loop.

**Later**

- **Split-screen live artifact view** — chat on one side, the document updating in real time on the other. A core centrepiece of the intended UX, but dependent on the template being fixed first.
- **Synthetic personas and DB seeding** — we generate our own rather than waiting on the client, and demo against them. No real personal data enters the prototype.
- Gamification and progress feedback across plan, sessions, and questions.
- Designed, styled PDF output.
- Second participant on their own device.
- Genuinely secure asymmetric disclosure.
- Jurisdictions beyond Victoria.

## Guardrails

- No legal, financial, tax, or medical advice — designed in, not bolted on as a disclaimer.
- No real personal data in the prototype; synthetic personas only.
- Tone matters more than anything else here. This is a product about death, used by people who are grieving or frightened. Anything glib or clinical fails.

## Notes

Santi works in parallel on his own fork. Work items are not tracked in this repo.
