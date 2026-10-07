// Browser end-to-end for the loose ends page: the grouping, answering one in
// place, and naming somebody for one that had nobody. Seeds a persona rather
// than running a conversation, so this costs nothing and can be run freely.
//
// Needs the dev database, a server on <base-url>, and `npx playwright install
// chromium --only-shell` once. It signs up two accounts, makes one of them an
// admin by running npm run make-admin, and seeds the other. Both are
// `…@example.test`; delete them afterwards.
//
// Usage: node --env-file=.env.local scripts/e2e-loose-ends.mjs [base-url] [screenshot-dir]
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const [BASE = "http://localhost:3000", SHOTS = "."] = process.argv.slice(2);
const CODE = process.env.SIGNUP_ACCESS_CODE ?? "handover-dev";
const PASSWORD = "correct-horse-battery";
const stamp = Date.now();
const startedAt = stamp;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();

async function signUp(email, name) {
  // One context per account: a shared one is already signed in as the first.
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-up`);
  // By name attribute: the label wraps a hint too, so its accessible name
  // isn't just the field's.
  await page.locator("input[name='name']").fill(name);
  await page.locator("input[name='email']").fill(email);
  await page.locator("input[name='password']").fill(PASSWORD);
  await page.locator("input[name='code']").fill(CODE);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-up"), { timeout: 40_000, waitUntil: "commit" });
  return page;
}

const adminEmail = `le-admin-${stamp}@example.test`;
const ownerEmail = `le-owner-${stamp}@example.test`;

const admin = await signUp(adminEmail, "Checker");
const owner = await signUp(ownerEmail, "John Owner");
check("two accounts created", true);

execFileSync("npm", ["run", "make-admin", "--", adminEmail], { stdio: "pipe" });

// ── Seed John into the owner account ──────────────────────────────────
await admin.goto(`${BASE}/admin/demo`);
await admin.getByRole("heading", { name: /demo record/i }).waitFor();
await admin.locator("select[name='persona']").selectOption({ label: "John — half way" });
const ownerOption = await admin
  .locator("select[name='userId'] option")
  .filter({ hasText: ownerEmail })
  .getAttribute("value");
await admin.locator("select[name='userId']").selectOption(ownerOption);
await admin.getByRole("button", { name: "Seed this record" }).click();
await admin.getByText("Seeded.").waitFor({ timeout: 40_000 });
check("John seeded into the owner account", true);

// ── The header link ───────────────────────────────────────────────────
await owner.goto(`${BASE}/home`);
await owner.getByRole("heading", { level: 1 }).waitFor();
check(
  "the header offers it once there is something to find out",
  (await owner.locator("header a[href='/loose-ends']").count()) === 1,
);
check(
  "the home count is a way through to it",
  (await owner.locator("main a[href='/loose-ends']").count()) === 1,
);

// ── The page ──────────────────────────────────────────────────────────
await owner.locator("main a[href='/loose-ends']").click();
await owner.waitForURL(/\/loose-ends$/, { timeout: 30_000, waitUntil: "commit" });
await owner.getByRole("heading", { name: "What's still to find out" }).waitFor();
const text = () => owner.locator("main").innerText();
let body = await text();

check("it counts them in a sentence", /4 things nobody has the answer to yet/.test(body), body.split("\n")[2]);
check("it says how many have somebody to ask", /3 of them have somebody who might know/.test(body));

const headings = async () =>
  owner.locator("main section h2").allInnerTexts().then((h) => h.map((x) => x.trim()));
let groups = await headings();
console.log("  groups:", JSON.stringify(groups));
check("each person is one errand", groups.includes("Ask Robyn") && groups.includes("Ask Jack"));
check("a name nobody recorded is still a group", groups.includes("Ask the accountant at Fenwick & Co"));
check("the ones nobody is named for come last", groups.at(-1) === "Nobody named yet");
check("the pressing one is marked", body.includes("Matters most"));
await owner.screenshot({ path: `${SHOTS}/le-1-page.png`, fullPage: true });

// ── A field that points at people refuses a sentence ─────────────────
// s3.expectations_communicated is routed to Jack and takes names only.
const jack = owner.locator("main section").filter({ has: owner.getByRole("heading", { name: "Ask Jack" }) });
const peopleCard = jack.locator("li").first();
await peopleCard.getByRole("button", { name: "Write the answer" }).click();
check("it says what shape the answer takes", (await peopleCard.innerText()).includes("Names only"));
await peopleCard.locator("textarea").fill("He told everyone years ago, I think");
await peopleCard.getByRole("button", { name: "Save it" }).click();
const refusal = await peopleCard.locator("[role='alert']").innerText({ timeout: 30_000 });
console.log("  refusal:", refusal);
check("a refusal lists the people instead of a field id", /Robyn/.test(refusal) && !/s3\./.test(refusal));
check("the refusal has no tool names in it", !/save_field|save_entity/.test(refusal));
check("what was typed is left where it is", (await peopleCard.locator("textarea").inputValue()).length > 0);

// ── Answering that one properly ───────────────────────────────────────
await peopleCard.locator("textarea").fill("Robyn, Jack");
await peopleCard.getByRole("button", { name: "Save it" }).click();
await owner.waitForFunction(() => !document.querySelector("main").innerText.includes("Ask Jack"), null, {
  timeout: 30_000,
});
body = await text();
check("answering it takes it off the page", !(await headings()).includes("Ask Jack"));
check("the count comes down", /3 things nobody has the answer to yet/.test(body), body.split("\n").slice(0, 4).join(" / "));

// ── A list of entries gets no box ─────────────────────────────────────
const robyn = owner.locator("main section").filter({ has: owner.getByRole("heading", { name: "Ask Robyn" }) });
const entityCard = robyn.locator("li").first();
const entityText = await entityCard.innerText();
check("an entries field says it belongs in a conversation", entityText.includes("belongs in a conversation"), entityText.split("\n").at(-1));
check("and offers no box to type into", (await entityCard.locator("textarea").count()) === 0);
check("it names the sitting that covers it", /covered by/i.test(entityText));
await owner.screenshot({ path: `${SHOTS}/le-2-after-answer.png`, fullPage: true });

// ── Answering a prose one ─────────────────────────────────────────────
const accountant = owner
  .locator("main section")
  .filter({ has: owner.getByRole("heading", { name: "Ask the accountant at Fenwick & Co" }) });
const proseCard = accountant.locator("li").first();
await proseCard.getByRole("button", { name: "Write the answer" }).click();
await proseCard.locator("textarea").fill("A private loan to a friend, repaid monthly in cash.");
await proseCard.getByRole("button", { name: "Save it" }).click();
await owner.waitForFunction(
  () => !document.querySelector("main").innerText.includes("Fenwick"),
  null,
  { timeout: 30_000 },
);
check("a prose answer is taken too", /2 things nobody has the answer to yet/.test(await text()));

// ── It really was stored ──────────────────────────────────────────────
await owner.reload();
await owner.getByRole("heading", { name: "What's still to find out" }).waitFor();
check("it survives a reload", /2 things nobody has the answer to yet/.test(await text()));

await owner.goto(`${BASE}/guide`);
await owner.getByRole("heading", { level: 1 }).waitFor();
const guide = await owner.locator("main").innerText();
check("the people answer is in the Guide", /Robyn/.test(guide) && /Jack/.test(guide));
check(
  "what was answered is no longer printed as not known",
  !/not yet known[^\n]*accountant at Fenwick/i.test(guide),
);
// s5.undisclosed_arrangements is a sealed field. Answering it from a new
// write path must not put it in the open document: the disclosure comes from
// the field, not from where the answer was typed.
check("a sealed answer stays out of the Guide", !guide.includes("A private loan to a friend"));
check("the Guide says it is in the envelope instead", /in the sealed envelope/i.test(guide));

await owner.goto(`${BASE}/guide/envelope`);
await owner.getByRole("heading", { level: 1 }).waitFor();
const envelope = await owner.locator("main").innerText();
check("and the envelope is where it actually is", envelope.includes("A private loan to a friend"));

// ── Naming somebody for one that had nobody ───────────────────────────
await owner.goto(`${BASE}/loose-ends`);
await owner.getByRole("heading", { name: "What's still to find out" }).waitFor();
const nobody = owner
  .locator("main section")
  .filter({ has: owner.getByRole("heading", { name: "Nobody named yet" }) });
check("it says why that group matters", (await nobody.innerText()).includes("nowhere to go"));
const orphan = nobody.locator("li").first();
const orphanTitle = (await orphan.locator("h3").innerText()).trim();
await orphan.getByRole("button", { name: "Say who would know" }).click();
// Case-folded against the recorded people, so this should come back as "Robyn".
await orphan.locator("input[list]").fill("robyn");
await orphan.getByRole("button", { name: "Note that down" }).click();
await owner.waitForFunction(
  () => !document.querySelector("main").innerText.includes("Nobody named yet"),
  null,
  { timeout: 30_000 },
);
groups = await headings();
console.log("  groups after routing:", JSON.stringify(groups));
check("it moves into that person's errand", groups.includes("Ask Robyn") && !groups.includes("Nobody named yet"));
const robynAgain = owner
  .locator("main section")
  .filter({ has: owner.getByRole("heading", { name: "Ask Robyn" }) });
check(
  "a name spelled differently doesn't become a second errand",
  (await robynAgain.innerText()).includes(orphanTitle),
  orphanTitle,
);
check("routing it doesn't answer it", /2 things nobody has the answer to yet/.test(await text()));
check("all of them now have somebody", /Every one of them has somebody who might know/.test(await text()));
await owner.screenshot({ path: `${SHOTS}/le-3-routed.png`, fullPage: true });

// ── The empty state ───────────────────────────────────────────────────
await admin.goto(`${BASE}/loose-ends`);
const adminBody = await admin.locator("main").innerText();
check("an account with no record is sent away", !adminBody.includes("still to find out"));

// ── Nothing broke on the server during this run ───────────────────────
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
const since = new Date(startedAt).toISOString();
const logged = await sql`
  select error_type, context, message from error_logs where created_at >= ${since}`;
check(
  "no failures were logged during the run",
  logged.length === 0,
  logged.map((r) => `${r.context}: ${r.message}`.slice(0, 120)).join(" | "),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`accounts to clean: ${adminEmail}, ${ownerEmail}`);
process.exit(failed.length ? 1 : 0);
