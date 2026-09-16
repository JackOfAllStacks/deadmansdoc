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

Early discovery phase — problem framing, competitor scan, and the interview question bank are in progress. No working prototype yet.
