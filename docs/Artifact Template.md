# Artifact Template v0.1

The definition of what the product produces. The interview exists to fill these fields; the session plan is these sections grouped into sittings.

Derived from the client's draft Family Guide, generalised beyond that one household and extended to cover the domains the question bank surfaced.

**Status:** draft for review. Once agreed, this becomes the machine-readable schema that the renderer and the interview agent both read from.

## Scope

All fourteen sections are mapped here and stay mapped — this is the full definition, and the question bank already covers it.

**Build scope for v1 is Sections 1, 2, 3 and 5** — start here, what to do in order, the people, and money in and out. Those four carry the demo: they are what someone actually needs in the first week, and they exercise every mechanic the rest of the template uses. The remaining sections are specified and waiting, to be brought in as time allows.

---

## The two documents

One record produces two printed artifacts.

**The Guide** — the open document. Left somewhere the family knows about, readable at any time. Everything needed to act.

**The Sealed Envelope** — printed separately, sealed, opened only after death. Holds what the person is willing to record but not willing to disclose while alive.

This is the paper-native answer to asymmetric disclosure: no trigger, no release mechanism, no server deciding anything. A physical seal.

### Disclosure levels

Every field carries one of three levels:

| Level | Meaning |
|---|---|
| **Open** | Printed in the Guide. |
| **Sealed** | Printed only in the Sealed Envelope. |
| **Pointer** | The Guide records *where a secret lives and how to reach it* — never the secret. Passwords, PINs, codes and account numbers never appear in either document. |

The default is Open. Sealed is chosen by the user, per field, during the interview — and the agent should offer it whenever it asks for a value, a balance, or something about a person.

### Sealed by default

These are offered as Sealed unless the user says otherwise:

- Balances, valuations, and anything that adds up to a net worth
- Financial arrangements the family doesn't know about
- Debts nobody knows about, and informal loans in either direction
- Financial dependents the family doesn't know about
- Anyone deliberately excluded or left less, and why
- Who is expected to disagree
- The master access to the credentials vault
- Any private message meant to be read after death

### When the envelope prints

**If any item is sealed, the envelope prints — however little is in it.** There is no minimum.

There is no safe alternative. Moving a lone sealed field into the Guide overrides an explicit instruction to withhold it, and dropping it destroys the one thing the person was most careful about. A one-line envelope is not a problem to design around; it is the person having made one deliberate choice.

The trigger is *any* sealed content, including a private letter on its own. A user who sealed no data but wrote a letter still gets an envelope.

If nothing at all is sealed, no envelope prints, and the Guide says so.

### How the two documents refer to each other

Sealing something must never make it invisible. The family cannot wait for information they don't know exists.

| Case | Behaviour |
|---|---|
| An envelope exists | The Guide states that it exists and where it is kept — never what is in it. |
| A field is sealed inside an otherwise open subsection | The Guide prints the open fields and marks that a value sits in the envelope. A marker, never a blank — a blank reads as "there is nothing here". |
| Every field in a section is sealed | The Guide still prints the section heading and a line saying its contents are in the envelope. A silently missing section is indistinguishable from a life without one. |
| Nothing is sealed | The Guide says there is no envelope, so nobody spends the worst week of their life looking for one. |

The envelope must also stand on its own. Someone may open it months later without the Guide to hand, so it repeats whose record it is, the date it was prepared, and a short framing line. A bare list of numbers is unusable.

### Reprints

Every reprint creates another envelope in the world, and the old one does not disappear. Both documents carry a version and a prepared-on date, on every page, and the review log records each reprint. An unsealed superseded envelope holding stale values is a worse outcome than no envelope at all.

---

## Section 0 — Front matter

Sets the tone. The letter is the reason this reads as something left *for* someone rather than an administrative handover, and it should be the last thing written, once the person has seen how much they've recorded.

| Field | Level | Domain |
|---|---|---|
| Letter to the family | Open | document-meta |
| Private letter, read after death | Sealed | document-meta |
| Who this document is for | Open | key-people |
| What this is and is not — no legal effect, not a will | Open | document-meta |
| Security note — no passwords or account numbers here | Open | credentials |
| Language and detail the user asked to avoid | Open | document-meta |
| Date prepared, and who was present | Open | document-meta |

---

## Section 1 — Start here _(v1)_

The single most useful page. Written for someone in the first hour, who cannot read anything longer than a list.

| Field | Level | Domain |
|---|---|---|
| The first three calls — who, why, how to reach them | Open | key-people |
| What must happen immediately, and what happens if it doesn't | Open | urgency |
| Who to call for what — financial, legal, medical, house, business | Open | key-people |
| Who to call when you don't know who to call | Open | key-people |
| What not to do yet — don't cancel, close, sign, or move money | Open | urgency |

---

## Section 2 — What to do, in order _(v1)_

Time-ordered, because the fear is doing the wrong thing in the wrong order.

| Field | Level | Domain |
|---|---|---|
| First 72 hours | Open | urgency |
| First 30 days | Open | urgency |
| First six months | Open | urgency |
| Deadlines that run from the date of death | Open | urgency |
| What becomes impossible once an institution is notified | Open | urgency |
| What would spoil, die, lapse or be lost in the first week | Open | urgency |
| Decisions needed within days, and who is qualified to make them | Open | urgency |
| Religious or cultural requirements with a time constraint | Open | health |

> Anything with a time constraint — particularly burial rites — must also appear in Section 1. It is the one category where being buried on page 40 is a failure.

---

## Section 3 — The people _(v1)_

| Field | Level | Domain |
|---|---|---|
| Immediate family and who currently lives in the home | Open | key-people |
| For each key person — name, relationship, role, contact | Open | key-people |
| What each is responsible for, before and after death | Open | key-people |
| How the key people relate to each other, and who has never met whom | Open | key-people |
| Professional advisers — accountant, lawyer, adviser, doctor | Open | key-people |
| Who knows the most about the financial affairs | Open | key-people |
| Who has been told what is expected of them, and who hasn't | Open | key-people |
| Who should not be contacted, or not given access | Open | key-people |
| Who the family would instinctively call who would be the wrong call | Open | key-people |
| Who is expected to disagree, and about what | Sealed | key-people |

---

## Section 4 — Legal documents

Locating and routing only. The document never interprets what any of these mean.

| Field | Level | Domain |
|---|---|---|
| Will — exists, last updated, what has changed since | Open | legal |
| Where the original is held, and who else holds copies | Open | legal |
| Executor and backup — named, told, agreed | Open | legal |
| Power of attorney — financial, medical, enduring | Open | legal |
| Advance care directive or stated position on treatment | Open | legal |
| Who prepared these documents, and whether they still practise | Open | legal |
| Binding financial agreements, prenuptial agreements, prior settlements | Open | legal |
| Roles held for other people — executor, attorney, trustee | Open | legal |
| Documents signed but not held a copy of | Open | legal |
| Anything in writing that contradicts something else in writing | Open | legal |
| Anyone deliberately excluded or left less, and whether they know | Sealed | legal |
| Information needed to carry out instructions in the will | Open | legal |

---

## Section 5 — Money in and out _(v1)_

The largest section, and the one where the open/sealed split does the most work. Structure and routing stay open; amounts go sealed.

### What exists

| Field | Level | Domain |
|---|---|---|
| Accounts held, and which are joint versus sole | Open | finances |
| Balances and values | Sealed | finances |
| Which account household bills actually come out of | Open | finances |
| What happens if that account is frozen | Open | finances |
| Cash, and where it is | Sealed | finances |
| Investments and assets held | Open | finances |
| Business or entity registrations | Open | finances |
| Accountant or bookkeeper, and what they do that the user doesn't | Open | finances |
| Who to contact before any major financial change | Open | finances |
| Where the financial documents are | Open | finances |
| Financial arrangements the family doesn't know about | Sealed | finances |

### Going out

| Field | Level | Domain |
|---|---|---|
| Regular bills, and who provides what | Open | finances |
| Which are automatic and which are paid by hand | Open | finances |
| Payments that must not be interrupted, and why | Open | finances |
| Direct debits that would fail silently rather than loudly | Open | finances |
| Anything paid annually that would only surface months later | Open | finances |
| Accounts that must not be closed because other things depend on them | Open | accounts |
| Where money would be burning immediately after death | Open | finances |

### Owed

| Field | Level | Domain |
|---|---|---|
| Mortgage, rent, loans, credit cards | Open | debts |
| Debts that would pass to someone else, or that someone assumes are theirs | Open | debts |
| Co-signed or jointly held obligations | Open | debts |
| Personal guarantees — a business loan, a lease, a family member's mortgage | Open | debts |
| Outstanding or disputed tax | Open | debts |
| Debts nobody in the family knows about | Sealed | debts |
| Money privately lent or borrowed, and whether there is a record | Sealed | debts |

### Still arriving

| Field | Level | Domain |
|---|---|---|
| Money owed that would still arrive after death | Open | incoming-money |
| Anything requiring the person to claim it personally | Open | incoming-money |
| Annual, seasonal or delayed payouts — distributions, bonuses, royalties, refunds | Open | incoming-money |
| Income nobody else knows to expect or chase | Open | incoming-money |
| Payments relating to an earlier period than the one they arrive in | Open | incoming-money |
| Amounts expected | Sealed | incoming-money |

---

## Section 6 — Superannuation and insurance

Separated from Section 5 because super sits outside the estate and is routinely missed.

| Field | Level | Domain |
|---|---|---|
| Funds held, including old ones from previous jobs | Open | super-and-insurance |
| Forgotten or unconsolidated accounts | Open | super-and-insurance |
| Death benefit nomination — binding or non-binding, last renewed | Open | super-and-insurance |
| Who is nominated, and whether that is still right | Open | super-and-insurance |
| Insurance held inside super — life, TPD, income protection | Open | super-and-insurance |
| Life and income protection policies held outside super | Open | super-and-insurance |
| Who to contact to start a claim | Open | super-and-insurance |
| Sums insured and account values | Sealed | super-and-insurance |

---

## Section 7 — Home and property

| Field | Level | Domain |
|---|---|---|
| Properties owned, and how each is held | Open | home-and-pets |
| Mortgages and loans against them | Open | home-and-pets |
| Property manager or tenants | Open | home-and-pets |
| Utility providers, and how each is paid | Open | accounts |
| Home and contents, vehicle, and other insurance | Open | home-and-pets |
| Council rates and how they are paid | Open | home-and-pets |
| Security system, alarm codes location, monitoring company | Pointer | home-and-pets |
| Systems someone must know how to operate | Open | home-and-pets |
| Who to call for plumbing, electrical, gardening, repairs | Open | home-and-pets |
| Warranties and service agreements | Open | home-and-pets |
| What would fall into disrepair, and how quickly | Open | home-and-pets |
| Property valuations | Sealed | home-and-pets |

---

## Section 8 — Belongings and physical access

The highest-decay section — most of this is unrecoverable if not written down.

| Field | Level | Domain |
|---|---|---|
| Who holds a key to the home right now | Open | physical-access |
| Where the spare keys are — home, car, safe, mailbox | Pointer | physical-access |
| Safe, lockbox or safety deposit box — where, which branch, who is a signatory | Open | physical-access |
| Whether access survives death, and what to do before notification | Open | physical-access |
| Off-site storage — unit, garage, a relative's shed | Open | physical-access |
| Important things whose location has never been written down | Open | physical-access |
| Items worth more than they look | Open | physical-access |
| Items needing special handling — cultural, religious, sentimental | Open | physical-access |
| Items in the house that belong to someone else | Open | physical-access |
| Belongings held by another person or an institution | Open | physical-access |
| What looks like rubbish but is not | Open | physical-access |
| What should be disposed of | Open | physical-access |
| Who should be given access to which belongings or places | Open | physical-access |
| Valuations, certificates and receipts, and where they are | Open | physical-access |
| What items are worth | Sealed | physical-access |

---

## Section 9 — Digital life and access

Nothing secret is printed. This section routes to the vault and flags what dies with the person.

| Field | Level | Domain |
|---|---|---|
| Whether a password manager is used, and which | Open | credentials |
| How to reach the vault — where the master access physically lives | Sealed | credentials |
| Where passwords are written down, if they are | Pointer | credentials |
| Device PINs and passcodes | Pointer | credentials |
| Which device receives two-factor codes | Open | credentials |
| What happens if that device is locked or the plan is cancelled | Open | credentials |
| Accounts secured only by biometrics — these die with the person | Open | credentials |
| Which account others recover through | Open | accounts |
| Accounts with no recovery path at all | Open | credentials |
| Where recovery codes and backup keys are kept | Pointer | credentials |
| Security question answers only the person would know | Sealed | credentials |
| Legacy contact set up with Apple, Google or similar | Open | accounts |
| What should happen to the phone number and email | Open | accounts |
| Services that must keep running for at least six months, and why | Open | accounts |
| Subscriptions to cancel, and when | Open | accounts |
| Subscriptions the family may not know about | Open | accounts |
| Services billed to a card that will be cancelled | Open | accounts |
| Memberships someone will need to take over | Open | accounts |
| Anything registered to a business or entity rather than a person | Open | accounts |

---

## Section 10 — Who depends on you

People and animals, together, because they are the same problem: something alive relies on this person and will keep needing things the day after they die.

### People

| Field | Level | Domain |
|---|---|---|
| Anyone financially dependent | Open | dependents |
| Minor children, their guardian, and whether that person agreed | Open | dependents |
| A child or relative with particular needs and ongoing arrangements | Open | dependents |
| Care provided to anyone, and what would stop | Open | dependents |
| Anyone relying on them for transport, shopping, medication or company | Open | dependents |
| Money sent regularly to anyone, here or overseas | Open | dependents |
| Dependents the rest of the family does not know about | Sealed | dependents |

### Animals

| Field | Level | Domain |
|---|---|---|
| Pets and animals owned | Open | home-and-pets |
| Who takes each one | Open | home-and-pets |
| Feeding and care routine | Open | home-and-pets |
| Veterinarian | Open | home-and-pets |
| Medication and particular needs | Open | home-and-pets |
| Where records, registration and insurance are kept | Open | home-and-pets |

---

## Section 11 — Health and end of life

Wishes belong here. Anything with a time constraint is lifted into Sections 1 and 2.

| Field | Level | Domain |
|---|---|---|
| Regular doctor and healthcare providers | Open | health |
| Pharmacist and repeat prescriptions to stop | Open | health |
| Where health records are kept | Open | health |
| Health insurance, and the instruction not to cancel it | Open | health |
| Medical expenses paid automatically | Open | health |
| Specialists or clinics with appointments booked | Open | health |
| Medical equipment on loan or rental in the house | Open | health |
| Preference about where they die — home, hospital, hospice | Open | health |
| Organ or tissue donation, and whether the family knows | Open | health |
| Consent to donate the body to research or teaching | Open | health |
| Burial or cremation, what happens to the ashes, and who decides | Open | health |
| Funeral wishes | Open | health |
| Prepaid plan, plot, or existing arrangement with a funeral director | Open | health |
| Money available to pay for the funeral, and where it is | Open | health |
| Family medical history the children should have for their own sake | Open | health |

---

## Section 12 — Loose ends

Things in motion that would otherwise be discovered by accident.

| Field | Level | Domain |
|---|---|---|
| Anything in progress — a settlement, a claim, a court date, a project | Open | urgency |
| Anyone expecting them somewhere in the coming month | Open | urgency |
| Mail that matters, and how often it arrives | Open | accounts |
| PO box, mail redirection, or post held anywhere | Open | accounts |
| What would surprise the family about their affairs | Open | document-meta |

---

## Section 13 — One page

Printed separately and kept somewhere obvious. Everything on it already appears above; this exists because nobody reads a forty-page document at 2am.

| Field | Level | Domain |
|---|---|---|
| Name, role, phone and email for every key contact | Open | key-people |
| The first three calls, repeated | Open | key-people |
| Anything with a deadline in the first week | Open | urgency |
| Where this document and the sealed envelope are kept | Open | document-meta |

---

## Section 14 — Review log

A record three years stale is more dangerous than no record, because it will be trusted.

| Field | Level | Domain |
|---|---|---|
| Date last reviewed, and by whom | Open | document-meta |
| What changed | Open | document-meta |
| Known gaps — recorded as gaps, not omitted | Open | document-meta |
| Who to ask about each gap | Open | document-meta |

> Gaps are content. An unanswered question that names who would know the answer is worth more than a blank.

---

## Settled

- **Fourteen sections stay mapped**; Sections 1, 2, 3 and 5 are the v1 build scope.
- **Death is the only event this template recognises.** Vault master access stays Sealed. Incapacity is deliberately out of scope, which means the Guide does not carry a path into the password manager for a person who is alive but cannot give it. That is a known, accepted limitation, not an oversight — see below.
- **No per-person disclosure.** Splitting the document so different people see different parts is dropped. The two-document split is the simpler form of the same idea.
- **No envelope threshold.** Any sealed content prints an envelope.

## Known limitations

**Incapacity.** Every rule here assumes death. A person who is alive but cannot communicate produces the worst case this design has: the family holds a Guide that deliberately routes around the sealed material, and no legitimate way to open the envelope. Opening it early is a decision no part of the product can make for them.

Worth revisiting once the death path works, because the brief raises incapacity directly and the interview already asks about enduring power of attorney — which is the mechanism that would normally answer this.
