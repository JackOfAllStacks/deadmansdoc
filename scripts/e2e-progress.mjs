// Browser end-to-end for how far through the record is: the measure on home,
// the section bars, and the claims about what a family would know. Seeds
// personas rather than running a conversation, so this costs nothing.
//
// The claim it exists to check is the one that would matter if it were wrong:
// a milestone must never read as true off a recorded gap. Margaret's record is
// finished and John's is half way, so one account should earn claims and the
// other shouldn't.
//
// Needs the dev database, a server on <base-url>, and `npx playwright install
// chromium --only-shell` once. Accounts are `…@example.test`; delete them after.
//
// Usage: node --env-file=.env.local scripts/e2e-progress.mjs [base-url] [screenshot-dir]
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const [BASE = "http://localhost:3000", SHOTS = "."] = process.argv.slice(2);
const CODE = process.env.SIGNUP_ACCESS_CODE ?? "handover-dev";
const PASSWORD = "correct-horse-battery";
const stamp = Date.now();

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();

async function signUp(email, name) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-up`);
  await page.locator("input[name='name']").fill(name);
  await page.locator("input[name='email']").fill(email);
  await page.locator("input[name='password']").fill(PASSWORD);
  await page.locator("input[name='code']").fill(CODE);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-up"), { timeout: 40_000, waitUntil: "commit" });
  return page;
}

const adminEmail = `pr-admin-${stamp}@example.test`;
const doneEmail = `pr-done-${stamp}@example.test`;
const halfEmail = `pr-half-${stamp}@example.test`;

const admin = await signUp(adminEmail, "Checker");
const finished = await signUp(doneEmail, "Margaret Owner");
const halfway = await signUp(halfEmail, "John Owner");
execFileSync("npm", ["run", "make-admin", "--", adminEmail], { stdio: "pipe" });

async function seed(personaLabel, email) {
  await admin.goto(`${BASE}/admin/demo`);
  await admin.getByRole("heading", { name: /demo record/i }).waitFor();
  await admin.locator("select[name='persona']").selectOption({ label: personaLabel });
  const value = await admin
    .locator("select[name='userId'] option")
    .filter({ hasText: email })
    .getAttribute("value");
  await admin.locator("select[name='userId']").selectOption(value);
  await admin.getByRole("button", { name: "Seed this record" }).click();
  await admin.getByText("Seeded.").waitFor({ timeout: 40_000 });
}

await seed("Margaret — finished", doneEmail);
await seed("John — half way", halfEmail);
check("both records seeded", true);

// ── The finished record ───────────────────────────────────────────────
await finished.goto(`${BASE}/home`);
await finished.getByRole("heading", { level: 1 }).waitFor();
const doneBody = await finished.locator("main").innerText();

check("the record leads, before the conversations", doneBody.indexOf("What's in the record") < doneBody.indexOf("sittings"));
check("the sitting bar says what it measures", /conversations done/.test(doneBody));
check("the document's own sections are shown", /The first few hours/.test(doneBody) && /Who's who/.test(doneBody));
check("a section with every field answered says so", /Answered/.test(doneBody));
check("claims about the family appear", /would know/.test(doneBody));
check("the claims name whose family it is", /Margaret's family would know/.test(doneBody), doneBody.match(/Margaret's family would know[^\n]{0,60}/)?.[0]);
const earned = (doneBody.match(/Margaret's family would know/g) ?? []).length;
check("a finished record earns several of them", earned >= 3, `${earned} shown`);
await finished.screenshot({ path: `${SHOTS}/pr-1-finished.png`, fullPage: true });

// ── The half-way record ───────────────────────────────────────────────
await halfway.goto(`${BASE}/home`);
await halfway.getByRole("heading", { level: 1 }).waitFor();
const halfBody = await halfway.locator("main").innerText();

check("it says what is still to come", /still to come/.test(halfBody));
check("it offers the nearest claim, with what it wants", /answers? away/i.test(halfBody), halfBody.match(/(One answer away|\d+ answers away)[\s\S]{0,120}/)?.[0]?.replace(/\n/g, " / "));
check("what is missing is named in words, not field ids", !/\bs\d\.[a-z_]+/.test(halfBody));
const halfEarned = (halfBody.match(/John's family would know/g) ?? []).length;
check("a half-way record earns fewer", halfEarned < earned, `${halfEarned} against ${earned}`);
await halfway.screenshot({ path: `${SHOTS}/pr-2-halfway.png`, fullPage: true });

// ── A gap is not an answer ────────────────────────────────────────────
// John's s3.advisers and s3.expectations_communicated are recorded gaps, and
// "who is who" needs s3.key_people and s3.responsibilities answered. The claim
// that must never appear is one resting on a field that says nobody knows.
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
const gapRows = await sql`
  select fv.field_id from field_values fv
  join records r on r.id = fv.record_id
  join "user" u on u.id = r.owner_user_id
  where u.email = ${halfEmail} and fv.status = 'unknown'`;
check("the half-way record really does hold gaps", gapRows.length > 0, `${gapRows.length}`);

const gapsOnly = `pr-gap-${stamp}@example.test`;
const gapAccount = await signUp(gapsOnly, "Gap Owner");
await seed("John — half way", gapsOnly);
// Turn every one of this record's answers into a recorded gap: nothing left to
// ask, and nothing a family would actually know.
await sql`
  update field_values fv set status = 'unknown', who_would_know = 'somebody', gap_priority = 'medium'
  from records r, "user" u
  where fv.record_id = r.id and r.owner_user_id = u.id and u.email = ${gapsOnly}`;
await gapAccount.goto(`${BASE}/home`);
await gapAccount.getByRole("heading", { level: 1 }).waitFor();
const gapBody = await gapAccount.locator("main").innerText();
// Scoped to the earned list. The card below it offers the *nearest* claim,
// which says "would know" too and should: that one is an aspiration, not a
// statement about the record as it stands.
check("a record that is all gaps earns no claim", /Nothing to say yet/.test(gapBody));
check("and each claim it is still missing is offered rather than asserted", /answers? away/i.test(gapBody));
check("and says there is nothing left to ask instead", /Nothing left to ask/.test(gapBody), gapBody.match(/Nothing left to ask/g)?.length + " sections");
check("while still counting the gaps as recorded", /nobody knows yet/.test(gapBody));
await gapAccount.screenshot({ path: `${SHOTS}/pr-3-all-gaps.png`, fullPage: true });

// ── The Guide says how much of itself exists ──────────────────────────
await finished.goto(`${BASE}/guide`);
await finished.getByRole("heading", { level: 1 }).waitFor();
const guide = await finished.locator("main").innerText();
check("the Guide says how much of it is covered", /\d+ of \d+ parts covered/.test(guide), guide.match(/\d+ of \d+ parts covered[^\n]*/)?.[0]);
// A record about a parent is not about "your" family, and this line is the
// one place that was easy to hard-code it.
check("and whose family it is about", /things Margaret's family would know/.test(guide));

// ── An empty record claims nothing ────────────────────────────────────
await admin.goto(`${BASE}/home`);
const adminBody = await admin.locator("main").innerText();
check("a record that doesn't exist yet shows no measure", !/What's in the record/.test(adminBody));

// ── Nothing broke ─────────────────────────────────────────────────────
const logged = await sql`
  select context, message from error_logs where created_at >= ${new Date(stamp).toISOString()}`;
check(
  "no failures were logged during the run",
  logged.length === 0,
  logged.map((r) => `${r.context}: ${r.message}`.slice(0, 120)).join(" | "),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`accounts to clean: ${adminEmail}, ${doneEmail}, ${halfEmail}, ${gapsOnly}`);
process.exit(failed.length ? 1 : 0);
