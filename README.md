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
| Model | Claude Sonnet 5 for both conversations, streamed, set in one place ([`src/lib/model.ts`](src/lib/model.ts)) |
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
node scripts/e2e-intake.mjs   # opening conversation and plan (spends API credit)
node scripts/e2e-sitting.mjs  # the whole journey, including a sitting (spends more)
node scripts/e2e-admin-record.mjs  # the admin view of a record it left behind
node scripts/e2e-loose-ends.mjs    # the gaps page, from a seeded record (free)
node scripts/e2e-progress.mjs      # how far through the record is (free)
```

`GET /api/health` reports whether the database is reachable and which content version is loaded.

`scripts/e2e-intake.mjs` drives a real browser through sign-up, the opening conversation and the plan, using a synthetic persona. It calls the real Claude API and needs `npx playwright install chromium --only-shell` once. Both scripts create `…@example.test` accounts; delete them afterwards.

`scripts/e2e-auth.sh` expects a server on `http://localhost:3000` (`npm run build && npm start`, or `netlify serve --offline --port 3000`) and the dev database. It creates `…@example.test` accounts; delete them afterwards. It pauses between groups of requests to stay under the sign-in rate limit, so it takes about a minute.

## Accounts and access

Auth is [Better Auth](https://www.better-auth.com), configured in [`src/lib/auth.ts`](src/lib/auth.ts), with its tables in our own database ([`db/migrations/002_auth.sql`](db/migrations/002_auth.sql)).

- **Sign-up is invite-only.** The form asks for an access code, sent as the `x-signup-code` header and checked on the server against `SIGNUP_ACCESS_CODE`. If that variable is unset, nobody can sign up. Failed attempts count towards the rate limit, so guessing codes is slow.
- **Email and password**, minimum 10 characters. There's no password reset yet; that needs an email provider.
- **Rate limiting** is stored in the database, since in-memory counters reset on every serverless cold start. Sign-in and sign-up allow 3 attempts per 10 seconds per IP.
- **Public:** `/`, `/sign-in`, `/sign-up`, `/api/health`, `/api/auth/*`. **Everything else requires a session.**
- [`src/proxy.ts`](src/proxy.ts) only checks that a session cookie *exists* and redirects early if not. The real check is `requireSession()` in [`src/lib/session.ts`](src/lib/session.ts); every protected layout, route handler and server action must call it. Pages under [`src/app/(app)/`](src/app/(app)) get it from their shared layout.

Regenerate the auth tables with `npx auth@<better-auth version> generate --config src/lib/auth.ts` if the auth config gains plugins or fields, and add the result as a new migration.

**Deleting an account** removes it and everything hanging off it — the record, the conversation, the plan — immediately and for good. With no email provider there's nothing to confirm through, so the current password is the check. The only thing left behind is any row in `error_logs`, whose references null out rather than cascading; nothing anyone typed is stored there.

**Admins** are a `role` on the user. The field is `input: false` in the auth config, so it can never be set by anything the browser sends. Admin pages return **404** rather than redirecting, so they don't announce themselves to accounts that shouldn't see them.

An admin makes other admins from the **People** list on `/admin`. Two things it won't do: change your own access, and remove the last admin. Both would leave a page nobody can reach, since granting admin needs an admin. The first admin on a fresh database has to come from outside that loop — `npm run make-admin -- someone@example.com` (`--remove` to take it away), which is also the way back in if every admin is somehow lost.

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

A new account goes `/start` → `/start/intake` → `/plan/new` → `/plan`. `/home` is a dashboard rather than a step: it names the one thing to do next, and everything else stays reachable from the header.

**Nobody is dropped into an empty box.** A conversation that hasn't started yet opens on what happens now, how long it takes, and what the record covers; the text box appears once someone chooses to begin. The client's feedback was about exactly this, and it applies to the opening conversation and the sittings alike.

**Starting** ([`src/app/(app)/start`](src/app/(app)/start)) records who the handover is for, who's in the room, and consent, including an acknowledgement that this isn't a will.

**The conversation** ([`src/lib/intake`](src/lib/intake)) is streamed to the browser as newline-delimited JSON. It has two tools: `record_intake` stores a rough picture (counts, yes/no, and which topics were raised unprompted), and `finish_intake` ends it.

- The model writes its reply **before** calling a tool, so a turn is normally one API call.
- The system prompt is fixed for everyone so it caches; per-person details go in a context block at the start of the conversation, fixed for its lifetime.
- Limits: 12 exchanges (after which the server finishes the conversation regardless), 2,000 characters a message, one reply at a time per record, and three model calls a turn.
- Tool input is validated against the zod schema in [`signals.ts`](src/lib/intake/signals.ts), which also generates the tool's JSON Schema. A failure goes back to the model as a tool error rather than being stored.
- A person's message is only saved once the model has replied, so a failed call leaves nothing behind and can simply be sent again.
- Every model call logs its token usage as `intake_model_call`.

**The plan can be rearranged.** Sittings nobody has started can be put in any order, by dragging a card or by the arrows on it. Dragging alone would be the wrong thing to build here: the person this is for may be in their eighties, on a touch screen, with an unsteady hand — so the arrows are the mechanism and dragging is the extra.

The slots stay put and the sittings move between them (`reorderSlots`), the same rule the opening conversation's re-cut follows: a plan's dates are something people arrange their month around, so moving the money sitting to the front gives it the date that was already first rather than dragging its own date along and leaving a hole. Dates are sorted before they're handed out, so they always run forwards down the plan even if one was moved out of order by hand.

**Going back to it.** The opening conversation stays readable after it finishes — it is the only thing that explains why the plan came out as it did — and it can be reopened to add something. **Finishing it is what does the work**, and the model is told so when it is in a reopened conversation ([`REOPENED`](src/lib/intake/prompt.ts)): without that it has nothing in front of it saying this is a second conversation, and it answers the afterthought, thanks them, says goodbye and leaves the conversation open — so nothing is ever re-cut. That was found by driving it, not by reading it.

Finishing it a second time re-cuts **only the sittings nobody has started**: they're re-estimated and re-ordered from the fuller picture, while anything done or in progress is left exactly as it was, because what was said in it is already in the record. The untouched sittings also keep their own dates and positions — the slots they already occupy are handed out again in the new order, so remembering something doesn't rearrange someone's month. Reopening is refused outright while a sitting is open. See `reviseRemaining` in [`build-plan.ts`](src/lib/plan/build-plan.ts).

**The plan** ([`src/lib/plan/build-plan.ts`](src/lib/plan/build-plan.ts)) is worked out in code, not by the model. [`data/session-template.yaml`](data/session-template.yaml) holds the sittings, their base minutes and the rules that adjust them; tune it there rather than in code. Order follows whatever was raised unprompted, then the template's own order. Sittings over 30 minutes split into parts. The build fails unless every v1 field is covered by exactly one sitting.

## The sittings

A sitting is one conversation about one area, started from `/plan` whenever suits. **The dates are a suggestion, not a gate** — any planned sitting can be started at any time, and one can be left part-way and picked up later. Only one runs at a time.

**What the model can record** ([`schema.ts`](src/lib/sitting/schema.ts)) is generated from [`artifact-fields.yaml`](data/artifact-fields.yaml), not written out by hand. Adding a field or an entity shape to that file changes the tools with no code change:

| Tool | For |
|---|---|
| `save_field` | One answer against one field — prose, a list, an ordered sequence, or a pointer at people |
| `save_entity` | A person, account, bill, debt, income stream or routing rule. The field id says which shape it is, so only that shape's keys are accepted |
| `save_amount` | A figure against something already recorded |
| `flag_gap` | An "I don't know", with who would know and how much it matters |
| `save_note` | Something worth keeping that no field covers |
| `finish_sitting` | Ends it, with a summary |

Three rules do most of the work:

- **Figures are sealed by construction.** An entity-typed field that is sealed — balances, expected amounts — is filled only by `save_amount`, against an entry that already exists. A number cannot be written into the open list beside it, whatever the model does.
- **Entities are upserted** on `(record, type, lower(label))`, so a person mentioned in five turns is one row. Repeated mentions are normal in conversation; without this they pile up.
- **Anything pointing at a person must name someone already recorded.** An unknown name comes back as a tool error listing who is known, which keeps the key-people list the spine of the document rather than a pile of half-known names.

Every value carries **`family_action`** (what someone who has never touched this will have to do — "nothing, it runs on its own" counts), **`confidence`** (stated / uncertain / inferred), and a disclosure, defaulting to the field's own.

**The question bank is a checklist, not a script** ([`coverage.ts`](src/lib/sitting/coverage.ts)). Each turn the server works out which questions still fill something this sitting covers and hasn't settled, ranked by priority then irreplaceability, and passes a few to the model, which writes its own questions. A field counts as settled once it holds an answer **or a recorded gap**, so nobody is asked twice about something they've already said they don't know. `question_asks` is written by the server from what the tools did — the model is never asked to keep track.

**Whose answer it is.** Two people share one keyboard, so every message is filed under somebody. That used to be a row of small radio buttons above the box, and in testing one person started typing while it was still set to the other — the whole exchange went under the wrong name, and the only reason anyone noticed was that the model worked out the truth from the first and third person and carried on regardless.

Silent is the problem, so the fix is to make it visible rather than to guess better: the control is a segmented one that says *Answering as*, every message carries the name it went under, and clicking that name hands the message to the next person along. The correction moves the stored role **and** the name in the block the model reads, so the transcript and the record can't disagree. Model-side inference was the other option and is still open, but it would be silent too — and it would be wrong with no way to put it right.

**The document is written in front of you.** A sitting is a split screen: the conversation on one side, and on the other the part of the Guide it is filling in, grouped the way the finished document groups it. Every field starts empty and fills in as the conversation goes. Empty stays empty — room waiting to be written in, not a line of filler saying there is nothing there.

**And it can be corrected by hand.** Any part of it can be typed into. An edit sends that one field's body to [`/api/sitting/edit`](src/app/api/sitting/edit/route.ts) and gets the whole document back, read out of the database rather than assembled from what was just sent — so what stays on screen is what was really stored. [`block.ts`](src/lib/sitting/block.ts) renders a field to text and parses that same text back, which is what lets the thing you read be the thing you edit, with nothing reformatted under the cursor. The body is built as real DOM rather than rendered by React, so a re-render mid-reply can't land in the middle of a sentence and take the cursor with it.

A hand edit goes through **the same zod schemas and validators as a tool call**, so nothing can be typed in that the model couldn't have recorded — a name that belongs to nobody is refused the same way. The refusal is rewritten for a person first: *"This part lists people by name, separated by commas — and only people already in the document: Robyn."* What they typed is left where it is, because the point of saying so is that it can be put right. Deleting a line is the one thing only a person can do; the model records and corrects but never removes.

**The person can see what's being covered.** Each sitting carries plain-language **topics** — "Who to ring first", "What must not stop" — written for someone who has never seen a field id. They live beside the sitting in [`session-template.yaml`](data/session-template.yaml), each naming the field ids it stands for, and the build fails unless every field a sitting covers belongs to exactly one of its topics. That constraint is the point: the topics are a promise about what a conversation will cover, so they can't quietly drift from what it actually does. They're shown as cards on the plan and as a strip along the top of the live document, ticking over as fields are settled — counted on the server from what is stored, never tallied in the browser. The two work at different altitudes: the areas say what ground is being covered, the document shows what is actually being written, and the field labels alone do neither.

They deliberately stop short of listing the questions themselves. Showing the whole checklist would turn the conversation back into a form, which is the thing it exists to avoid.

**What a turn costs, and why.** Each turn logs a `sitting_turn` line: how many model calls it took, and why the loop went round again. That line is what turned "something in the turn loop is going round too often" into a number.

The cause was never the loop. It was **rejected tool calls**, and each rejection costs a whole extra call. Measured with runs of [`e2e-sitting.mjs`](scripts/e2e-sitting.mjs), same persona, same script:

| | calls a message | what the extra calls were |
|---|---|---|
| Before anything | 2.12 | 7 of 8 were `save_field` with the wrong slot for the field, or two slots at once |
| Telling the model which slot each field wants | 1.44 | same cause, fewer of them |
| One `value` argument, hint deleted | **1.778** | **worse.** 0 wrong-slot calls — and 6 new ones writing prose into a field that takes names |
| One `value` argument, hint restored | 1.33, then 1.22 | 2 each: one empty call, and the rule that a name must be recorded before anything points at it |

`save_field` takes **one argument**. `value` is a list of strings whatever the field holds, and the field's own declared type decides what happens to it — joined for prose, kept in order for an ordered sequence, resolved against the recorded people for a field that points at people. There is no slot to pick wrong and no second slot to send alongside it, so neither error can be expressed. Across every run since, neither has occurred.

**The middle row is the lesson.** Deleting the per-field hint alongside the slots looked like removing a workaround, and the measurement said otherwise: wrong-slot calls went to zero exactly as intended, while prose written into a name-only field went from none to six. The hint was never propping up the schema — it was carrying type information the model has no other way to get, and a label like "Who has been told what is expected of them" reads like a question you answer in a sentence. The slots were the schema's problem; this is a different one, and it needed both fixes.

Two alternatives were considered and rejected. A string-or-list union puts the choice straight back, with better odds. Splitting `save_field` into `save_text` and `save_list`, each with a `field_id` enum holding only its own fields, looked strongest — strict tools constrain decoding, so a list could not reach a prose field at all — until the failure mode: a model that picked the wrong tool would then be *constrained into picking a wrong field*, and a silently wrong field is worse than a rejected call.

Judge any change here the same way, with runs of the same script, rather than by reasoning about it. This one was reasoned about, shipped, measured, and found to be half right.

**Caching.** The system prompt is identical for every sitting and every person. What changes — who this is, what's recorded, what's left, how long is left — goes in a system message **after** the history, so the cached prefix stays valid.

**Stopping.** At four minutes remaining the model is told to draw to a close; if someone says they're done, it finishes in that turn without asking again. A turn cap ends the sitting server-side regardless. Leaving part-way keeps everything — a sitting stays open until it's finished.

**A reply outlives the browser.** If someone closes the tab or reloads mid-reply, the turn still finishes and saves server-side. A page opened while that's happening asks [`/api/sitting/state`](src/app/api/sitting/state/route.ts) and waits, rather than sending into a locked sitting.

## How far through this is

The discovery brief asked for a large, intimidating task made to feel **finite**. What existed was a progress bar and minute estimates, and a count of sittings done measures a *schedule* rather than an achievement — a sitting can finish having recorded very little. So the record is the measure now, and the sittings are what gets you there. The sitting bar is still on `/home`, below it, and says "conversations done" so it stops reading as the score.

What makes a big thing feel finite is **specificity**: being told exactly what you have got, in terms of what the people you leave behind would now be able to do. [`data/milestones.yaml`](data/milestones.yaml) holds nine of those — "would know who to ring first", "would know what not to touch yet". They are data rather than copy in a component because each one is a claim about the record, and the claim and the fields behind it must not be able to drift apart. The build fails on a milestone naming a field that doesn't exist, one that names no fields at all, or one resting on a **sealed** field — that last because the envelope is opened after a death, so it can't be what makes "your family would know" true today.

**The distinction the whole thing turns on** ([`progress.ts`](src/lib/progress.ts)):

- **settled** — every field holds an answer *or* a recorded gap. Nothing left to ask.
- **complete** — every field holds an answer.

A gap is knowledge and it counts: "nobody knows where that is" is exactly what a family needs telling. It is not an answer. A claim is only ever shown off *complete*, so the product cannot tell somebody their family would know who to ring while the record says nobody knows. Getting that backwards is the worst thing this could do, which is why it has its own tests and its own browser check.

**The end of a sitting** used to be "that's this sitting done" and a button out, which threw away the one moment where somebody had just done something hard. It now says what the conversation got — counted on the server from what was stored, never a round number — which of its topics it closed, and which claims became true *during it*. That last is a difference taken across the sitting rather than a snapshot, so it says what this conversation did rather than what was already there.

**No points, no streaks, no badges, no levels, no confetti.** That is written into the data file as well as here, so it isn't re-litigated later. Rewarding somebody for progress on their own death is exactly the register this can't afford. The only thing ever congratulated is the record, and only for what is actually in it.

## What's still to find out

A gap is the one thing in the record that asks something of the person afterwards, and until this branch nothing helped them do it. `flag_gap` has always stored the field, whoever might know, and how much it matters; three things read that and none of them was the person whose record it is — the Guide prints a line, `/home` shows a count, the admin view lists them.

**[`/loose-ends`](src/app/(app)/loose-ends)** is grouped by **who would know**, because two questions for Peter are one errand and not two. Inside a group it reads by what matters, then in template order, so a group reads down the document rather than in whatever order things were said. Between groups the most pressing errand leads, then the biggest. The ones nobody has been named for always come last — not because they matter least but because they have nowhere to go, and they should be what the page leaves you looking at.

Each one can be **answered in place** or **given a name**.

Answering goes through [`apply-edit.ts`](src/lib/sitting/apply-edit.ts), which is the body of `/api/sitting/edit` lifted out. The whole value of the hand-edit path is that it runs the same schemas and validators a tool call runs, so a second copy of it would be a second set of rules. One thing that falls straight out of sharing it: answering a **sealed** field here writes a sealed value, because the disclosure comes from the field and not from where the answer was typed — so a figure cannot be smuggled into the open document through a new box.

Naming who would know is deliberately **not** restricted to the people already recorded. The key-people list is the spine for fields that *point at* people, because those are references the document resolves; `who_would_know` is a note to whoever reads the Guide, and "the solicitor" is a perfectly good answer — as is a name the record has never heard. Where the name does match somebody recorded, their recorded spelling wins, so one person doesn't become two errands. The model has always been able to write a free name there; a stricter box would have been a second set of rules again.

A field holding a **list of entries** gets no box, and says which sitting covers it instead. An account with a reference number and a location is not something to type into a one-liner, and the conversation that covers it asks the questions that go with it.

Nothing has to be answered. A question with the right person's name on it is already worth more to a family than a blank, which is why putting a name to one counts as progress here.

## Getting around, and the admin view

Every signed-in page shares a header: **Home**, **Your plan** once there is one, **Opening conversation** once there is a record, and an account menu with **Your account**, **Admin** for admins, and **Sign out**. Which links appear follows how far someone has got, worked out in [`journey.ts`](src/lib/journey.ts) — there's no use offering a plan to somebody who hasn't made one.

**[`/home`](src/app/(app)/home)** is where someone lands: the next thing to do with a button on it, every sitting with the areas it covers, and a count of what's in the record — including gaps, which are counted separately because "nobody knows where that is" is itself worth recording.

**[`/account`](src/app/(app)/account)** shows who you're signed in as, lets you change the name the conversation calls you, summarises your record, and deletes the account.

**[`/admin`](src/app/(app)/admin)** is for whoever is tuning the thing: every account, every record, and the failures from [`error_logs`](db/migrations/004_admin_errors.sql) — what kind, which HTTP status, which model served it, how long before it gave up. Netlify's function logs are per-deploy and awkward to search after the fact; this outlives the deploy and can be queried.

**[`/admin/records/[id]`](src/app/(app)/admin/records)** is one record in full: every field with what was recorded against it, what the family would have to do about it, how sure they were, the entries and the gaps, anything kept that no field covered, and the whole conversation in order. It is someone's account of their own death, and the page says so.

Failures are recorded by `logFailure()` in [`src/lib/errors.ts`](src/lib/errors.ts), which classifies them coarsely (`rate_limit`, `overloaded`, `auth`, `bad_request`, `server_error`, `network_error`, `app_error`) and **never throws** — logging a handled error must not create an unhandled one. A failure with no HTTP status never reached the provider at all, which is a different problem from one it answered and refused.

### The two documents

The Guide and the Sealed Envelope are **rendered, not written** ([`render.ts`](src/lib/artifact/render.ts)). Every field is already typed, already in template order, and already carries its own disclosure, so there is nothing for a model to decide: the same record always produces the same document, and nothing can appear that nobody said. The fork needed a model for this because its data was free-form; ours doesn't.

The awkward rules from [the template](docs/Artifact%20Template.md) are the ones that matter, and they're the ones under test:

- A sealed item leaves a **visible marker** in the Guide, never a blank — a blank reads as "there is nothing here".
- A section whose every item is sealed still prints its heading and says where its contents are. A missing section is indistinguishable from a life without one.
- **One sealed item is enough for an envelope to print.** There is no minimum.
- If nothing is sealed, the Guide says so, and nobody spends the worst week of their life hunting for an envelope that was never printed.
- A gap prints as what it is — "Not yet known. Peter may know." — because a routed gap beats a blank.

**Two outputs, one set of rules.** The renderer produces a [`Doc`](src/lib/artifact/doc.ts) — sections, parts, entries — and Markdown is one way of writing that out. The page a person reads is another, typeset rather than shown as source. Neither can drift from the other, because neither decides what appears. The documents use exactly two inline marks, `**strong**` and `_quiet_`, and the renderer is the only thing that writes them, so the reading view needs a sixteen-line formatter rather than a Markdown parser.

**The person can read their own Guide**, at [`/guide`](src/app/(app)/guide) — the thing the whole product exists to make, and until this branch visible only to admins. Their own Sealed Envelope sits behind one more click: it is their record, so it is theirs to read, but it holds what they chose to keep back and shouldn't be on screen by accident. The admin view still shows the raw Markdown, because when you are tuning the interview what matters is exactly what prints.

**Printing** takes the page, not the Markdown, so what comes off the printer is what was on screen: the app's chrome is dropped, the palette goes black on white whatever the screen was set to, and headings don't fall at the foot of a page. The document keeps its own title and front matter when it prints, since the page furniture naming it has gone.

### The completeness check

How much of the template a record covers. Most of it is arithmetic: a field with a value is recorded, a field with a recorded gap is a known unknown. **One model call** answers the only question the data can't — whether something is genuinely missing or simply doesn't apply to this person, which is usually only knowable from what was said ("we're not religious, there's no rush"). It runs on demand, never on page load, and it only judges the fields that are still outstanding.

A verdict of "doesn't apply" is ignored unless the model quotes the words behind it. Silence isn't evidence, and neither is someone saying they're done for the day.

## Demo records

Showing the product used to mean improvising answers live and paying for model calls to produce what it already knows how to produce. [`/admin/demo`](src/app/(app)/admin/demo) fills an account with an invented person instead — the plan, what was said, what was recorded, the gaps, and the sealed figures — in about a second and for nothing, because no model is involved.

The people live in [`data/personas`](data/personas) and are **invented**: no real person, number or place, and the guardrail against real data applies here more than anywhere. They're checked the same way the artifact fields and the question bank are, and a persona that names a field which doesn't exist **fails the build**. One check earns its place especially: a figure can only be put on a field whose disclosure is `sealed`, so a persona cannot be written that leaks a number into the Guide.

Seeding **replaces** whatever that account had, which is what makes it repeatable between run-throughs. It fills an account that already exists rather than creating one, so nothing here touches sign-up or passwords; and because a record is written across half a dozen tables with no transaction spanning them, a failure part-way clears up after itself rather than leaving something that looks seeded and isn't.

What this does *not* do is show the product being used. For that the conversation has to actually run — see what's next, below.

## The look of it

**The mark** ([`mark.tsx`](src/components/mark.tsx)) is two cupped hands under a folded letter. Not a bird, which reads as afterlife imagery and is exactly the glib register this can't afford; not a handshake, which is a business transaction. It is about custody — something held carefully, and passed on — and the envelope is already a real object here, so the letter is a thing rather than a metaphor. The hands stop short of meeting: an earlier version closed that gap and the whole thing read as a teacup.

Everything visual is a token in [`globals.css`](src/app/globals.css): surfaces, text, lines, one accent, and the three states anything in the record can be in (**recorded**, **not known**, **still to come**). Pages use the names — `bg-surface`, `text-muted`, `border-line` — and never a raw colour or an opacity-on-black trick, so the whole product can be re-toned from that one file. The palette is warm rather than clinical on purpose: this is a product about dying, used by people who are frightened or grieving, and stark monochrome reads as a hospital form.

Headings are set in a serif and body text in a grotesque, because what this makes is a **document**, and it should look like one from the first screen while the interface itself stays out of the way.

**Each sitting has a colour**, carried wherever that sitting appears: its card on the plan and on home, its chips, and the landing page. The colour is doing work — it says which part of the record you're looking at before you've read anything — so it belongs with the information rather than on top of it. A second, warmer accent exists for the places the green would feel cold.

[`src/components/ui.tsx`](src/components/ui.tsx) is the vocabulary every page is built from — `Page`, `PageHeader`, `Card`, `Button`, `Badge`, `Progress`, `Note`, `Alert`. [`chat.tsx`](src/components/chat.tsx) holds the conversation itself, shared by the opening conversation and the sittings, which had a copy each until this branch. [`topics.tsx`](src/components/topics.tsx) is the scaffolding. The rule is that a page composes these: if something doesn't fit, it earns a variant there rather than a private copy in the page.

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

## The fork

[`spaceshanti/deadmansdoc1`](https://github.com/spaceshanti/deadmansdoc1) is a fork of this repo that went a different way on purpose: a plain HTML/JS proof of concept, used to tune the interview prompt and watch what the model actually captures. This repo stays the real one — TypeScript, auth, migrations, deploy pipeline — and ideas travel from the fork to here.

What's being carried across, translated rather than copied:

| From the fork | Why | Status |
|---|---|---|
| `family_action` on every fact | What a non-expert has to *actually do* about it. "Nothing to do, it's on autopay" is a valid answer and worth recording. | Landed |
| `confidence` — stated / uncertain / inferred | A document family will rely on should say how sure it is. | Landed |
| Priority on gaps | This schema already treats an unanswered field with `who_would_know` as content, not a blank. The fork's contribution is ranking them. | Landed |
| Free-form overflow alongside the fixed fields | The fields make the printed artifact predictable; the overflow catches what they'd otherwise drop. | Landed, as `save_note` |
| `error_logs` | Queryable failures that outlive the deploy. | Landed |
| The drafted Guide, and the completeness check | The check reads the transcript as well as the saved data, because "no, we don't have any pets" only ever exists in what was said. | Landed — the Guide as a renderer rather than a generation step |

Its question bank is the same 167 these 63 were narrowed from, so nothing is owed there. Its credentials questions — where passwords and recovery codes are kept — stay out as written: the answer is the **Pointer** disclosure level, recording where something is without ever collecting the secret itself.

## Where this is up to

The spine is built and walkable end to end: someone signs up, talks to the opening conversation, gets a plan of sittings, runs a sitting, and what they said comes out as a Guide and a Sealed Envelope that follow the disclosure rules.

**Built**

- [Artifact template](docs/Artifact%20Template.md) — all 14 sections mapped; **Sections 1, 2, 3 and 5 are the v1 build scope**.
- [Artifact fields](data/artifact-fields.yaml) and [question bank](data/question-bank.yaml) — v1 fields given stable ids, and the bank narrowed onto them. Cross-checked at build time.
- [Schema](db/migrations) — records, sittings, messages, entities, field values, overflow, failures.
- Next.js app on Netlify, Neon with a `dev` branch, health check.
- Accounts: access-code sign-up, sign-in, deletion, admin roles granted from inside the app.
- The opening conversation, and the plan of sittings built from it in code.
- The sitting interview: typed capture into the artifact fields, startable from the plan whenever suits.
- The Guide and the Sealed Envelope, rendered from data rather than written by a model.
- The completeness check, and the admin view of a record.
- A front end: a visual language, a component vocabulary, a header, a home worth landing on, and scaffolding around both conversations.
- The split screen: the document written in front of you during a sitting, and correctable by hand.
- The Guide and the Sealed Envelope, readable and printable by the person whose record it is.
- Seeded demo records, so showing the product costs nothing and needs no improvising.
- The gaps as something a person can act on: grouped by who would know, answerable in place.
- Progress measured as the record rather than the schedule, with claims that have to be earned.

**Not built: a demo of the experience.** A seeded record shows what the product makes; nothing yet shows it being made. See what's next, below.

### The problem the front end had to solve

Shown to the client, the feedback was not about the capture or the documents — it was about being dropped into a chat box.

An open text field asks the person to know what's worth saying. A form of the old kind asked a question and gave you somewhere to put the answer; a conversation asks you to produce the material yourself, from your own head, about your own death. That is a harder thing to do, and the interface offered almost no help with it.

So the work was not decoration. It was **scaffolding**: showing what ground is being covered, what's been got so far, what's still to come, and what sort of thing a useful answer looks like — enough structure that someone can lean on it, without collapsing back into a form and losing what the conversation is for.

What that turned into is described under [Getting around](#getting-around-and-the-admin-view) and [The sittings](#the-sittings): plain-language **topics** per sitting, held in [`session-template.yaml`](data/session-template.yaml) and checked at build time, shown before a conversation starts and ticked off as it runs — and, during a sitting, the document itself being written in the next column, which is the most direct answer to the empty box there is.

## What's next, in order

Each of these is a branch. The front end came first so the rest is built in its vocabulary rather than retrofitted; what follows is ordered the same way, cheapest-unlock first.

### 1. A scripted run through the real agents

Seeded records cover showing the *output*. What they can't show is the *experience* — the conversation actually happening, the document filling in as someone talks. That still means improvising answers or pasting a script in by hand.

A scripted persona driven through the real agents would fix it. Slower and it costs credit, so it stays a deliberate choice rather than the only way to demo.

### 2. The styled PDF

Printing works now — the browser's own print of the reading view, which is honest paper with no new code. What's still missing is a *designed* artifact: something that looks like it was meant to be kept, rather than a web page that went through a printer. Deliberately last, because it only makes sense once the rest has settled.

### Later, unordered

- Sections 4 and 6–14 of the template.
- Password reset and email verification (needs an email provider).
- A second participant on their own device.
- Genuinely secure asymmetric disclosure.
- Jurisdictions beyond Victoria.

## Known debts

Things that are true about the code today, recorded so they are chosen rather than discovered.

| | |
|---|---|
| **Sittings still cost more than the opening conversation** | 2.12 model calls a message, then 1.44, now 1.22–1.33. What's left is a different cause: `save_entity` sent with an attribute key the entry doesn't hold — `"phone" isn't something s1.routing_map records` — which is the same shape of problem the slots were, one level down. The server knows every entry's keys; the model finds them out by being told no. Worth the same treatment, and worth measuring the same way. |
| **Sonnet files less tidily than Opus** | Same script, same persona: a phone number went to an overflow note instead of onto the person, and a "don't ring him yet" landed in an entry's notes rather than the field for things not to do yet. Sonnet is the right call for now on cost. Judge any change with `scripts/e2e-sitting.mjs`, not by feel. |
| **Admins can read every transcript** | Accepted, deliberately. It is the tool for tuning the interview, and the data is synthetic. It needs an answer before anyone's real life goes in, and not before. |
| **The split into parts never happens** | The planner splits a sitting over 30 minutes into parts, but no sitting can reach 30 under the current rules, so that path is unreachable from real data. Built and tested; don't promise it in a demo. `reviseRemaining` declines to re-cut a plan containing one rather than guess at how the parts should be redrawn. |
| **The visual language has had one pair of eyes on it** | Tokens, type scale and components are in place and consistent, but the palette and spacing are a first pass, checked at desktop and phone width in both colour schemes and no further. It is a foundation to react to, not a finished design. |

## Guardrails

- No legal, financial, tax, or medical advice — designed in, not bolted on as a disclaimer.
- No real personal data in the prototype; synthetic personas only.
- Tone matters more than anything else here. This is a product about death, used by people who are grieving or frightened. Anything glib or clinical fails.

## Notes

Santi works in parallel on his own fork. Work items are not tracked in this repo.
