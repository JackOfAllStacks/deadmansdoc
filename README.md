# The Handover

An AI-assisted system that helps someone build a personalised set of instructions for the people they leave behind — covering the knowledge, responsibilities, and processes those people would otherwise have to reconstruct from scratch after a death.

This is a Vibrance product exploration (6-week prototype), led by Jack with Santi, under oversight from Pete and Sahil.

## What this is

- Helps a user create a **personalised handover document** for family, built through an AI-driven interview rather than a static checklist.
- Captures knowledge, responsibilities, processes, contacts, and locations — the everyday things a family needs to know that a will doesn't cover.
- Helps surface **unknown unknowns**: information the user wouldn't think to record unless prompted.
- Points to and integrates with existing tools (password managers, document storage) rather than replacing them.

### Not a will

| | Will | The Handover |
|---|---|---|
| Nature | Legal document | Practical handover & instruction system |
| Covers | Distribution of assets, estate, guardianship | Knowledge, processes, contacts, locations, instructions |
| Answers | What happens, who is legally entitled | What needs doing, how things work, where things are, who to call |

> A will determines what happens to your estate. The Handover explains what the people you leave behind need to know and do.

The product explicitly does **not** touch distribution of assets, and is not a substitute for legal, financial, tax, or medical advice — it can tell you what to ask and whom to ask, not what the answer is.

## Two use cases, one product

- **Preparing for your own death** — protecting and educating your own family in your absence.
- **Preparing for a parent's death** — getting knowledge out of a parent's head, especially where the parent is reluctant, elderly, or not technical.

Both run on the same product; one person should be able to use it for themselves and for a parent.

## Guardrails

- No legal, financial, tax, or medical advice — ever.
- No real personal data in the prototype; build and test against synthetic personas.
- Security and privacy architecture must be designed in, even though it isn't fully implemented at prototype stage.
- Tone matters — this is a product about death, for people who are grieving or frightened.

## Repo structure

All current project material lives under [`Discovery/`](Discovery):

- **`01. Initial Docs/`** — source reference documents (project brief, an example family handover guide) translated to Markdown.
- **`Questions/`** — the elicitation question bank: one file per candidate interview question, covering contacts, finances, property, digital access, pets, health, and end-of-life wishes.
- **`Question Brainstorming/`** — drafts and framing notes for how questions are written and narrowed down.
- **`Core System Specification Notes.md`** — the working definition of what the system is and how it differs from a will.
- **`Initial Competitor Research Scan Takeaways.md`** — market scan notes (existing digital estate/legacy tools, gaps, positioning).
- **`Potential Use Case's for Demonstration.md`** — candidate product features/demo ideas.
- Story map and logic-branching diagrams for the interview flow.

## Status

Discovery is done; a first prototype now exists (see below). It only does
**collection**: an AI-led interview that talks to the user and saves
structured information (people, facts, gaps) to a database. It does not
generate a finished handover document — that's left for a later agent to
build from this stored data.

## Prototype: the collection app

An AI interview, deployed on Netlify, that fills in `people` / `facts` /
`gaps` tables in a Postgres (Neon) database as the conversation happens,
using the question bank and framing techniques under `Discovery/` as its
guide. See [`SECURITY_NOTES.md`](SECURITY_NOTES.md) for what is and isn't
safe about the current build.

### Stack
- **Frontend:** static HTML/CSS/JS in [`public/`](public) — no build tooling.
- **Backend:** Netlify Functions in [`netlify/functions/`](netlify/functions)
  (`record.js` to start/resume a session, `chat.js` to run one interview turn).
- **LLM:** any OpenAI-compatible chat-completions API with tool calling —
  see [`src/llm.js`](src/llm.js). Defaults to an open-weight model via Groq
  for prototyping; swap providers by changing env vars only.
- **Storage:** Neon Postgres, schema in [`db/schema.sql`](db/schema.sql).
- **Question bank:** [`scripts/build-question-bank.js`](scripts/build-question-bank.js)
  compiles `Discovery/Questions/*.md` and the framing-techniques note into
  `src/data/` at build time, so the discovery docs stay the single source of
  truth — re-run it after editing anything under `Discovery/`.

### Data model
- `records` — one per subject (self or parent), with a resume code.
- `sessions` — one per sitting (who was present, consent).
- `messages` — full transcript, including tool calls, for continuity across sessions.
- `people` — contacts, roles, what they hold/oversee, contact details.
- `facts` — one row per discrete piece of information, tagged by category.
- `gaps` — things the subject doesn't know, plus who might.

### Running locally
```
npm install
cp .env.example .env   # fill in DATABASE_URL and LLM_API_KEY
npm run db:migrate     # applies db/schema.sql to your Neon database
npm run dev            # builds the question bank and runs `netlify dev`
```
Requires the [Netlify CLI](https://docs.netlify.com/cli/get-started/) (installed
via `npm install` as a dev dependency) and a [Neon](https://neon.tech) project.
