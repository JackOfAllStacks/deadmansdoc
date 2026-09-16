---
date: 2026-09-10
time: 01:47
last_edited: 2026-09-10 01:47
tags:
aliases:
---
**PROJECT BRIEF**

**The Handover**

_An AI-powered product to help people prepare for death — their own, or a parent's._

| **Prepared by** | [[Sahil]]                           |
| --------------- | ----------------------------------- |
| **For**         | Jack (lead) and [[Santiago\|Santi]] |
| **Oversight**   | [[Pete Cohen\|Pete]]                |
| **Date**        | 3 September 2026                    |
| **Duration**    | 6 weeks                             |

# **1. Why this project exists**

When someone dies, the people left behind inherit two things: grief, and an administrative problem they are completely unprepared for. The second one makes the first one worse.

The administrative problem is not small. It is weeks of work, spread over months, conducted by people who are exhausted, upset, and missing the only person who could have answered their questions. Every one of those questions had an easy answer while the person was alive.

There is a lot of generic advice available about this. Government checklists, bank hardship pages, funeral director guides, “what to do when someone dies” articles. None of it solves the actual problem, because the actual problem is not _what are the general steps_ — it is _what did this specific person have, where is it, and who do I call about it._

That gap is what we want to attack.

# **2. The problem, in my own words**

Everything below is mine. These are the questions I cannot currently answer about my own mother, who is in her eighties and in ok but not great health. I have written it exactly as it came out. Read it properly — it is the best product spec in this document.

If my mum passes away, I have zero idea what to do. Who is the first call? What do we do with the body? What happens to her house. Where is her will? I know her will is going to say shared equally between me and my sister, but can we sell the place straight away? How do we stop gas and electricity and water and phone bills. Who are her providers? Even if we knew who they are, can we just call them and tell them she has passed, or do we need her username and passwords? Where are all her passwords? I doubt she has a password app, but maybe she does. What about getting access to her super? She has a financial advisor and I know his name, but I don't know what she holds. She has a safe deposit box at the bank. She told me where the key is stashed in her house, but I can't recall. She also told me that if she died, the bank will not allow access to the box even though I am a joint signatory, so I should go and empty it straight away before they get wind of her passing. What do we do with all her jewellery? We will need to sell it but will need to engage a goldsmith most likely. Do we have to let the government know?

  
  

Note the texture in that. Half of these are not “steps in a process” — they are _unknown unknowns_, cultural specifics, one-off assets, and half-remembered conversations. A generic checklist catches almost none of it.

# **3. The two use cases**

## **Use case A — Preparing for my own death**

I hold all the financial knowledge in my household. Sara does not know how to log into our bank accounts, what accounts exist, what insurance we hold, what our tax obligations are, that the house alarm monitoring bill arrives quarterly, or that Vibrance will continue paying money to my estate for months after I die. If I died tomorrow, my family would be lost — and not just administratively. This use case is about **protection and education in my absence**, not just admin reduction.

## **Use case B — Preparing for a parent's death**

Here I am not the subject, I am the adult child. The information lives in someone else's head, and getting it out requires a conversation most families never have. The product has to work when the person holding the knowledge is reluctant, elderly, not technical, or all three.

**These are the same product.** One person should be able to run it for themselves and for a parent. That duality is a core design constraint, not a nice-to-have.

**A third scenario worth thinking about:** the person who arrives _after_ the death with nothing prepared. Does the product have anything to offer them? A product that only works if the deceased prepared in advance has a serious activation problem. We are not asking you to solve this — we are asking you to have a view on it.

# **4. What we think the hard part is**

Do not spend your time building a checklist. Checklists are free, they already exist, and they are not the value.

Our hypothesis is that the defensible value sits in four places:

1. **Elicitation.** Knowing what to ask _this specific person_, adapting as it learns. If you mention a safe deposit box, it should probe on the key, the branch, the signatories, and the access-on-death problem. If you mention Indian heritage, it should know to ask about gold and jewellery and how it will be valued and divided. This is where AI earns its place — a patient, adaptive, non-judgmental interviewer that never gets bored on question 200.
2. **The “I don't know” path.** The most valuable output for a first-time user may not be a completed record. It may be a prioritised list of _things you need to go and find out_, and specifically the ones that get much harder once the person has died.
3. **Retrieval under stress.** The person using this at 2am the night their mother died is not the person who filled it in. Different emotional state, different needs, different interface. Consider whether the product has two modes — a calm “organise” mode and a crisis “what do I do right now” mode — running off the same data.
4. **Staleness.** A record that is three years old is _more_ dangerous than no record, because it will be trusted. How does this thing stay alive over ten or twenty years?

There is a fifth problem that may be the real differentiator: **asymmetric disclosure.** An eighty-year-old may be perfectly willing to record where the safe deposit box key is, but unwilling to tell her children what she is worth. The product may need to let her enter information that her family can only see after she dies, or see only partially. Think about this early — it shapes the architecture.

# **5. Objectives**

**Primary:** a working, clickable prototype at the end of six weeks that we can put in front of real users, use to sharpen the product definition, and decide whether to build properly.

**Secondary:** a clear, defensible point of view on what the product actually _is_ — the artefact it produces, who it serves, where AI sits in it, and what we would build next.

This is a Vibrance product exploration. Several of our clients operate in adjacent spaces — aged care, personal legal services, trustee services, health insurance. If this works it has a life beyond us. Build it as though it will be shown to a client, because it might be.

# **6. The design questions you need to answer**

You are not being asked to be product designers in isolation — Sahil and Pete will be closely involved in discovery. But you need to form and defend a view on:

- **What is the end artefact?** A document? A private password-protected site the family can access? A living app? A printed emergency pack? Something else? The answer is genuinely open.
- **Where does AI sit?** In the interview? In the drafting? In the crisis-mode guidance? In keeping the record current? All of these? Be specific — “it's AI-powered” is not an answer.
- **What is the relationship to a password vault?** We do not want to build one; good ones exist. Does the product integrate with one, point to one, or deliberately stay clear?
- **Who has access, and when?** Owner, family, executor, adviser — before death and after. What triggers the change?
- **How does it handle jurisdiction and specificity?** Victorian probate is not NSW probate. Super is not covered by a will. These details matter and getting them wrong is worse than staying silent.

# **7. Guardrails — non-negotiable**

- **The product never gives legal, financial, tax or medical advice.** It can tell you what to ask, whom to ask, and in what order. It cannot tell you whether you can sell the house, when you can access the super, or what your tax position is. Design this in from day one; it is not a disclaimer you bolt on at the end.
- **No real personal data.** Build and test against synthetic personas. We will supply three. Do not put anyone's actual financial details, account numbers or credentials into the prototype.
- **But design as though it were real.** Security and privacy architecture is part of the product design deliverable even though we are not implementing it properly at prototype stage. Show us you have thought about where the data would live, who could see it, and what happens if the file leaks. This product's entire premise is trust.
- **Tone matters enormously.** This is a product about death, used by people who are grieving or frightened. Anything glib, cute or overly clinical will fail. Get this wrong and nothing else matters.

# **8. Approach**

Roughly 30% converge, 70% build. Move fast on the thinking.

Be aware that the total effort available here is small — around 15 person-days across six weeks. That is not enough to build everything, so a large part of the job is deciding what _not_ to build. We would much rather see one part of this working properly end to end than five parts half-finished. If by week three it is clear the full concept won't fit, tell us and cut it deliberately rather than discovering it in week six.

## **Week 1 — Converge**

Rapid scan of what already exists (digital estate organisers, online will platforms, funeral pre-planning, digital legacy tools — locally and overseas). Not an exhaustive market study; half a day, focused on _what have others got wrong and what is the gap_. Then a short concept note: what the product is, who it is for, what the artefact is, where AI sits. One or two pages. Pete and Sahil will react hard to this.

## **Week 2 — Define and wireframe**

The interview architecture (what gets asked, in what order, how it branches). The output artefact. A paper or clickable wireframe. Scope locked with Sahil and Pete by end of week 2.

## **Weeks 3–4 — Build**

Working prototype. First internal test with Pete and Sahil at the end of week 4 — running end to end, not a demo of screens.

## **Week 5 — Test and iterate**

Three to five real user sessions (see below). Watch people use it. Fix what breaks.

## **Week 6 — Land it**

v1 prototype, plus a short handover pack: what we learned, what we would build next, what it would take, and enough technical documentation that someone else could pick it up.

# **9. Test users**

Available to you: me, Pete, Sara, my mother (80s), my sister, and my father and his wife. That is a genuinely good spread — the person who holds the knowledge, the people who would inherit the problem, and both use cases live.

I am aware I am handing you my family as a test panel. Treat them accordingly: these are real conversations about death with people who have not asked to be part of a product sprint. Prepare properly, keep sessions short, and let me make the introductions.

Book these early. People's diaries fill. Do not leave testing until week 5 to organise.

# **10. Roles and ways of working**

**Jack** — lead. 6 days total across the six weeks (nominally 1 day/week). Accountable for the build, for the workplan, and for directing Santi's work. There is flex to extend if the project warrants it — make the case if you need it.

**Santi** — 1.5 days per week, roughly 9 days across the project. Works under Jack's direction.

**Work in person, in the office, on Jack's days.** Santi is early in his career and this is a build project — the fastest way for him to become useful is to sit next to Jack and work on the same thing. Treat Jack's day each week as a paired working day, not a handover meeting.

That leaves Santi with roughly half a day each week outside Jack's presence. Those hours are worth having, but only if two things happen: Jack leaves each session with Santi's offline work already scoped and written down, and Jack looks at what came back before the next in-person day. Work that sits unreviewed for six days is work that was wasted, and it will stall Santi rather than stretch him.

**Pete** — oversight and product guidance. Up to half a day a week available.

**Sahil** — product owner and primary user. Up to half a day a week available. Also the source of the problem statement, so use him.

**Beyond that, the working model is yours to design.** By the end of day one we want a workplan from you covering:

- Where work lives (repo, task board, shared drive — one place, not four)
- What Santi works on between in-person days, and how it gets scoped before Jack leaves
- Which day of the week you are both in, and whether that stays fixed
- A written check-in rhythm and a demo cadence
- What “done” means for a piece of work before it comes back

Some things we will insist on regardless: **everything written down**. Working side by side is not an excuse for decisions that live only in someone's head — if you agree something in the room, it goes in the shared record before you leave. No verbal-only instructions, no “have a think about it” tasks. Every piece of work scoped with an explicit definition of done. With this little time, ambiguity is the most expensive thing you can produce.

If you cannot produce a credible workplan by the end of day one, we will give you one. We would rather you produced it.

# **11. Resources**

- Vibrance accounts and Claude API budget — available to you
- Any expense needs sign-off from Sahil or Pete before you commit to it. Not a hurdle, just ask. We would rather approve something quickly than find out afterwards
- Tooling choice is yours; justify anything unusual

# **12. Deliverables**

| **When**          | **What**                                                             |
| ----------------- | -------------------------------------------------------------------- |
| **End of day 1**  | Workplan and ways of working                                         |
| **End of week 1** | Concept note (1–2 pages) + market scan summary + persona set         |
| **End of week 2** | Interview architecture, artefact definition, wireframe, scope locked |
| **End of week 4** | Working prototype, end-to-end internal test                          |
| **End of week 5** | 3–5 user tests completed, findings documented                        |
| **End of week 6** | v1 clickable prototype + handover pack                               |

# **13. What good looks like**

At the end of six weeks, I should be able to sit down with my mother, open this thing, and have a conversation with her that neither of us has ever managed to have — and come away with something that means my sister and I are not lost when the day comes.

If it does that, everything else follows.