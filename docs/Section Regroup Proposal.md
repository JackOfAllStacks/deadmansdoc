# Proposal: tightening the four sections

Follow-up to the 2026-10-08 walkthrough. For agreement before anything changes in the product.

## What was raised

Four sections feels right. Two of today's four overlap, though ("Money going out" and "What's owed, and what's still coming in"), and a whole area is missing: the everyday running of a life, which we've been calling **life admin**. The goal is four sections that don't overlap and that together cover everything.

## Proposed four

| # | Section | What it covers | Comes from |
|---|---|---|---|
| 1 | **The people around you** | Who's who, who to ring first, who does what, who to be careful with | Unchanged |
| 2 | **The first days and weeks** | What has to happen straight away, what must wait, what has a clock on it | Unchanged |
| 3 | **Money** | Everything with a balance: accounts, investments, debts, guarantees, tax, money still coming in | Today's two money sections, merged. Day-to-day bills move out to Life admin |
| 4 | **Life admin** | Everything that keeps the household running: bills and providers, subscriptions, where passwords are kept, keys, the home, the person who waters the garden | Bills and direct debits moved out of Money, plus new material (see below) |

The test for Money against Life admin: **Money is what you own and owe. Life admin is what you pay for and look after.** A mortgage is Money. The electricity bill is Life admin. "Which account the bills come out of, and what happens if it's frozen" stays in Money, because it's about the account. Life admin points back to it.

## What moves where

**Stays in Money** (today's "Money going out" and "What's owed / still coming in"):
- Accounts held, and which are joint or sole
- Balances
- Investments
- Cash
- Business or entity registrations
- Where the financial documents are
- Accountant or bookkeeper
- Who to contact before a major financial change
- Arrangements the family doesn't know about
- Which account the household runs on, and what happens if it's frozen
- Accounts that must not be closed
- Mortgage, loans and cards
- Debts that pass on
- Co-signed obligations
- Guarantees
- Tax
- Hidden debts
- Private loans
- All of "still arriving"

**Moves to Life admin:**
- Regular bills and who provides what
- Which bills are automatic and which are paid by hand
- Payments that must not be interrupted
- Direct debits that would fail silently
- Things paid annually that surface months later
- Where money would be wasted right after death

**New to Life admin.** These aren't in the product yet. They come from template sections 7–9, and question write-ups for most of them already exist in `docs/Questions/`:
- Utility providers and how each is paid. Council rates.
- Subscriptions to cancel, subscriptions the family may not know about, memberships someone will need to take over
- Whether a password manager is used, and where the way into it lives (never the password itself)
- Which phone gets the security codes, and what should happen to the phone number and email
- Who holds a key, where the spare keys are, any safe or deposit box
- Who to call for repairs and the garden, and what would fall into disrepair, and how fast
- Home, contents and car insurance

## People as a view, not only a section

People turn up in every section: the accountant in Money, the neighbour with the key in Life admin. Two suggestions:

1. **Do People first.** Knowing who's who makes every later section quicker, because the AI can say "is that Peter, the accountant?" instead of starting from scratch. The plan already suggests this order by default. We would just stop moving it later.
2. **Show each person across the whole record.** One page per person listing everything they're mentioned in: "Peter: accountant, knows about the tax, has a key." The data for this already exists, so it's a new view, not new questions.

## What this costs

- **Money becomes longer.** Merged, it's around 35–40 minutes for a typical household, so the product splits it into two parts automatically ("Money, part 1 of 2"). The alternative is to trim questions to keep it to one sitting.
- **Life admin is new content.** Roughly 15–20 new fields, their questions, and the matching parts of the final Guide. This is most of the work.
- Records already started on the old four keep their answers. No field is renamed, only regrouped.

## Decisions needed

1. Are these the right four names?
2. Should Money split into two parts, or be trimmed to fit one?
3. Which of the new Life admin items matter most for the first version? Suggestion: bills and subscriptions, passwords (where they're kept), and keys.
4. Should People be fixed as the first session?
