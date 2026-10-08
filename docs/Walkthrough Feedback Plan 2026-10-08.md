# Walkthrough Feedback Plan — 2026-10-08

From the client demo walkthrough on 2026-10-08. The overall read was very positive ("it feels like a product"); the feedback is about making it guided rather than directed, and getting it ready to hand to real testers.

Goal for this round: something we can put in front of a handful of testers (Damien, Megan, friends and family) and talk through with prospective clients (State Trustees, Anglicare, GMHBA as a capability example) — not a finished product.

## Work items

### 1. The AI always ends on a question
Every turn in the opening conversation and in each session must end by inviting the next answer: a question, or a prompt like "is there anything else about…?". It can stay broad and the AI still chooses its own path, but the person should never be left to volunteer the next thing unprompted. Assume older users who will wait to be led.

- Add the rule to `src/lib/sitting/prompt.ts` and `src/lib/intake/prompt.ts`.
- Exception: when the person says they're done, it wraps up without another question (existing behaviour).
- No client input needed.

### 2. Remove the "answering as" speaker switch
People will forget to flip it and then worry they've spoiled the record; addressing the wrong person by name erodes trust more than not naming anyone at all. Questions are worded about the person the record is for ("your dad", "John"), so whoever is typing answers on their behalf.

- Remove the toggle from the session and opening-conversation chats, their API routes, the transcript format and the demo player.
- The AI never addresses whoever is typing by name.
- Older stored messages carrying a speaker must still load.
- No client input needed.

### 3. Let people choose their own pace — no suggested schedule
Keep the chunking (roughly half-hour sections, time estimates, progress, "about X minutes left"). Drop the AI-suggested dates and rhythm ("once a week"). People will fit it around their own lives — some will do it all in one day.

- Plan creation no longer asks for a start date or rhythm; the plan is an ordered list of sessions anyone can start at any time.
- Show total time left rather than dates.
- Say "session" rather than "sitting" in everything the person sees. Internal names (routes, tables, types) stay as they are.
- No client input needed.

### 4. Staged demo accounts and a landing page fit for testers
People struggle to follow the auto-running demo. Give them accounts they can open at different points: blank, part-way, complete.

- Seed demo records at three stages from the existing personas.
- Give the signed-in home page enough explanation that a first-time tester knows what they're looking at and what to do.
- Tell people plainly, at sign-up and on the landing page, not to enter passwords or account numbers, and that this is a test that the team can see.
- Sign-up stays behind the single shared access code; no email verification.

### 5. Tighten the four sections (proposal only — needs client sign-off)
Keep four sections, but make them not overlap and together cover everything:

- **Money** — merge "Money going out" and "What's owed / still coming in": banks, debts, mortgage, cards, super, investments.
- **Life admin** — new: utilities, subscriptions, where passwords are kept, keys, the person who waters the garden.
- **The first days and weeks** — keep.
- **The people around you** — people appear in every section; consider doing this first (knowing who's who unlocks the rest) and showing people as a view across the whole record.

Deliverable: a written proposal mapping every field in `data/artifact-fields.yaml` to the new four, for the client to approve before `data/session-template.yaml` changes.

### 6. Handover readiness
- Rewrite the README so someone picking it up in five weeks can change sections and questions without us. Move roadmap material out of it.
- Transfer the repository to the client's GitHub organisation (Jack — needs their org name and an owner on their side).

## Also noted, not in this round
- Possible bug: a completed section on Margaret's record showing "1 in" — check whether it is counting unknowns. Investigate alongside item 4.
- "None" answers appearing in the final guide: leave as is — knowing something was asked and the answer was none is useful.
- Copy review: a document of every fixed piece of copy (where it appears, why it matters, current text, space for a rewrite) for the client to go through word by word. To follow once items 1–4 settle the copy.
- Security for a real-data pilot: Neon row-level security / encryption, confirm the Better Auth setup, backups and who has access. Today, admins can see every record.
- Mobile interface: Santi.
- Voice input, which would bring per-message speaker attribution back into question.

## Order
1, 2 and 3 first (small, no client input, biggest improvement to how it feels), then 4 so the URL can be handed out, then 5 as a proposal, then 6.

## Status — 2026-10-08

| # | Item | Status |
|---|---|---|
| 1 | AI always ends on a question | Done — rule added to both prompts |
| 2 | Remove the speaker switch | Done — control, re-filing and stored names removed; older messages still load |
| 3 | No suggested schedule; "session" wording | Done — no dates or rhythm anywhere; shows time left; UI and AI say "session" |
| 4 | Staged demo accounts; tester notice | Done — three resettable accounts on `/admin/demo`; notice on sign-up and getting started; removed the untrue "nothing here is shown to anyone else" |
| — | "One answer away" on a finished record | Fixed — it was a field recorded as nobody-knows, shown as "still to cover". Now says "noted as nobody knows yet" with a link to answer it |
| 5 | Tighten the four sections | Proposal written: [Section Regroup Proposal](Section%20Regroup%20Proposal.md). Waiting on client decisions |
| 6 | Handover readiness | README rewritten; design history moved to [Design Notes](Design%20Notes.md). Repo transfer still needs the client's GitHub org |
