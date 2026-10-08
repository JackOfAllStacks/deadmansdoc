// Browser end-to-end: sign-up → start → opening conversation → plan.
//
// Talks to the real Claude API, so each run costs roughly US$0.10–0.15, and
// creates two …@example.test accounts that should be deleted afterwards.
//
// Needs a running server (npm run build && npm start) on the dev database,
// and a browser: npx playwright install chromium --only-shell
//
// Usage: node scripts/e2e-intake.mjs <base-url> <signup-code> [screenshot-dir]
import { chromium } from "playwright";

const [BASE = "http://localhost:3000", CODE, SHOTS = "."] = process.argv.slice(2);
const stamp = Date.now();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// Margaret (82) with her daughter Priya. Rambly on purpose: several answers
// cover more than one topic.
const SCRIPT = [
  ["Priya", "It's Mum, my brother Dev and me really. Dad died four years ago. Dev lives in Perth so it'll mostly fall to me."],
  ["Margaret", "I bank with the Commonwealth, there's a term deposit there too, and my super. I pay all my own bills, always have. Oh and I have a safe deposit box at the branch, Priya knows about that."],
  ["Margaret", "No business, nothing like that. The house is paid off. But I went guarantor on a loan for Dev years ago and I honestly don't know if that's still there."],
  ["Priya", "Mum sees an accountant, Raj, once a year, and there's the solicitor who did her will. That's about it for professionals."],
  ["Margaret", "I'm Hindu. The cremation should happen quickly, within a day or so if it can."],
  ["Margaret", "Nothing's going on at the moment. There's a small pension from Dad's work that comes in each month, I suppose that stops?"],
  ["Priya", "I think that covers it."],
  ["Priya", "Yes, that's everything for now, thank you."],
  ["Priya", "We're done for today."],
];

const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

async function signUp(context, name, email) {
  const page = await context.newPage();
  await page.goto(`${BASE}/sign-up`);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByLabel("Access code").fill(CODE);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/start$/, { timeout: 30_000, waitUntil: "commit" });
  return page;
}

// ── Account A: the full journey ───────────────────────────────────────
const a = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const emailA = `e2e-intake-${stamp}@example.test`;
const page = await signUp(a, "Priya", emailA);
check("new account lands on /start", page.url().endsWith("/start"));
await shot(page, "1-start");

// Server-side validation: bypass the browser's required checks.
await page.getByLabel("My parent").check();
await page.getByLabel("Their first name").fill("Margaret");
await page.evaluate(() => document.querySelectorAll("[required]").forEach((el) => el.removeAttribute("required")));
await page.getByRole("button", { name: "Begin" }).click();
await page.locator("form [role=alert]").waitFor({ timeout: 15_000 });
check("start form rejects missing acknowledgement", /not a will|isn't a will/i.test(await page.locator("form [role=alert]").innerText()));
check("typed name survives the error", (await page.getByLabel("Their first name").inputValue()) === "Margaret");

await page.getByLabel("Who's here today?").fill("Priya, Margaret");
await page.getByLabel(/I understand this is not a will/).check();
await page.getByLabel(/happy to begin/).check();
await page.getByRole("button", { name: "Begin" }).click();
await page.waitForURL(/\/start\/intake$/, { timeout: 30_000, waitUntil: "commit" });
check("start form creates the record", page.url().endsWith("/start/intake"));
// Nobody is dropped into an empty box: the text field appears once someone
// chooses to begin.
await page.getByRole("button", { name: "Start the conversation" }).click();
await page.getByLabel("Your answer").waitFor();
check("greeting names Margaret", (await page.locator("ol li").first().innerText()).includes("Margaret's"));

/**
 * One exchange. The segmented speaker control's radio is sr-only and its label
 * sits over it, so a person clicks the label -- checking the input directly is
 * the thing a person can't do, and Playwright rightly refuses it.
 */
let lastSeconds = "0";
async function say(speaker, text) {
  await page
    .locator("label")
    .filter({ has: page.locator('input[name="speaker"]') })
    .filter({ hasText: new RegExp(`^${speaker}$`) })
    .click();
  await page.getByLabel("Your answer").fill(text);
  const started = Date.now();
  await page.getByLabel("Your answer").press("Enter");
  await page.waitForFunction(
    () => {
      // The turn that ends the conversation takes the composer with it, and
      // which panel replaces it depends on whether there was already a plan:
      // "see your plan" the first time, "that's been taken into account" when
      // something was added later. So the test is simply whether the composer
      // is still there and done waiting.
      const box = document.querySelector('textarea[aria-label="Your answer"]');
      return !box || box.form?.dataset.busy === "false";
    },
    null,
    { timeout: 180_000 },
  );
  lastSeconds = ((Date.now() - started) / 1000).toFixed(1);
}

const transcript = [];
let finished = false;
for (const [i, [speaker, text]] of SCRIPT.entries()) {
  await say(speaker, text);
  const seconds = lastSeconds;
  const bubbles = await page.locator("ol > li").allInnerTexts();
  const alert = await page.locator("form [role=alert]").allInnerTexts();
  transcript.push({ speaker, text, reply: bubbles.at(-1), seconds, alert });
  console.log(`\n[${speaker}] ${text}\n[agent, ${seconds}s] ${bubbles.at(-1)}${alert.length ? `\n[alert] ${alert.join(" ")}` : ""}`);

  if (i === 1) {
    await shot(page, "2-intake");
    await page.reload();
    await page.getByLabel("Your answer").waitFor();
    const after = await page.locator("ol > li").count();
    check("conversation survives a reload", after === bubbles.length, `${after} vs ${bubbles.length} messages`);
  }
  if (await page.getByRole("link", { name: "See your plan" }).count()) {
    finished = true;
    break;
  }
}
check("intake finishes within the script", finished, `${transcript.length} messages sent`);
await shot(page, "3-intake-done");

if (finished) {
  await page.getByRole("link", { name: "See your plan" }).click();
  await page.waitForURL(/\/plan\/new$/, { waitUntil: "commit" });
  await page.locator("section ol > li").first().waitFor();
  const cards = await page.locator("section ol > li").allInnerTexts();
  check("plan preview lists the sittings", cards.length >= 4, `${cards.length} sittings`);
  console.log("\nPLAN PREVIEW:\n" + cards.map((c) => "  - " + c.replace(/\n/g, " | ")).join("\n"));
  await page.getByLabel("How often").selectOption("fortnightly");
  const start = await page.getByLabel("First sitting").inputValue();
  await shot(page, "4-plan-new");
  await page.getByRole("button", { name: "Use this plan" }).click();
  await page.waitForURL(/\/plan$/, { timeout: 30_000, waitUntil: "commit" });
  await page.locator("main ol > li").first().waitFor();
  const saved = await page.locator("main ol > li").allInnerTexts();
  check("plan is saved", saved.length === cards.length, `${saved.length} rows`);
  console.log("\nSAVED PLAN (start " + start + ", fortnightly):\n" + saved.map((c) => "  - " + c.replace(/\n/g, " | ")).join("\n"));

  // Move the first sitting a week later.
  const first = page.locator("main ol > li").first();
  const dateText = () => first.locator("span.text-sm").filter({ hasText: /day \d/ }).first().innerText();
  const before = await dateText();
  await first.getByRole("button", { name: "Change date" }).click();
  const current = await first.getByLabel("New date").inputValue();
  const [y, m, d] = current.split("-").map(Number);
  const later = new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
  await first.getByLabel("New date").fill(later);
  await first.getByRole("button", { name: "Save" }).click();
  await first.getByLabel("New date").waitFor({ state: "detached", timeout: 15_000 });
  await page.waitForFunction((b) => ![...document.querySelectorAll("main ol > li span")].some((el) => el.textContent === b), before, { timeout: 15_000 }).catch(() => {});
  const after = await dateText();
  check("a sitting can be rescheduled", after !== before, `${before} → ${after}`);
  await shot(page, "5-plan");

  // Where each page goes once there is a plan. /home is a dashboard rather
  // than a step now, and the finished conversation stays readable, so only the
  // two that would be a step backwards send you somewhere else.
  for (const [path, lands] of [
    ["/home", "/home"],
    ["/start", "/home"],
    ["/start/intake", "/start/intake"],
    ["/plan/new", "/plan"],
  ]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForURL((u) => u.pathname === lands, { timeout: 15_000, waitUntil: "commit" }).catch(() => {});
    check(`${path} lands on ${lands}`, new URL(page.url()).pathname === lands, page.url());
  }

  // ── Reopening it, and the re-cut ────────────────────────────────────
  //
  // This is the path a bug sat on, undetected, from the day re-entry merged
  // until the day something else happened to use the same function:
  // applyRevision set a column the sittings table has never had, so every
  // revision failed outright and reopening the conversation never once re-cut
  // a plan. The unit tests mock applyRevision, and no script had ever
  // *finished* a reopened conversation -- it was reachable only by driving it.
  // So this is here to make sure it stays driven.
  const planRows = async () => {
    await page.goto(`${BASE}/plan`);
    await page.locator("main ol > li").first().waitFor();
    return (await page.locator("main ol > li").allInnerTexts()).map((r) => r.replace(/\s+/g, " ").trim());
  };
  const minutesOf = (rows) => rows.map((r) => (r.match(/about (\d+) min/) ?? [])[1]).join(",");
  const datesOf = (rows) => rows.map((r) => (r.match(/· ([A-Z][a-z]+day \d+ [A-Z][a-z]+)/) ?? [])[1]).sort().join(",");
  // The sequence number runs straight into the title in innerText.
  const titlesOf = (rows) => rows.map((r) => (r.match(/^\d+\s*(.+?)\s+(To do|Done|Open now|Skipped)/) ?? [])[1]).join(" / ");

  const was = await planRows();
  await page.goto(`${BASE}/start/intake`);
  await page.getByRole("button", { name: "Add something to this" }).click();
  if (await page.getByRole("button", { name: "Start the conversation" }).count()) {
    await page.getByRole("button", { name: "Start the conversation" }).click();
  }
  await page.getByLabel("Your answer").waitFor({ timeout: 30_000 });
  check("a finished conversation can be added to", true);

  // Both of these move signals the planner scales on: a family trust adds to
  // two sittings, and more people to tell adds to a third.
  const AFTERTHOUGHTS = [
    ["Priya", "Sorry, we forgot something. Mum is a trustee of a small family trust that holds the house, and there's a bit of share income that comes with it."],
    ["Margaret", "And there are six grandchildren, plus Dev's wife. They'd all need telling."],
    ["Priya", "That's everything, thank you."],
    ["Priya", "Yes, we're done."],
  ];
  let reFinished = false;
  for (const [speaker, text] of AFTERTHOUGHTS) {
    await say(speaker, text);
    console.log(`\n[reopen ${speaker}] ${text}\n[agent, ${lastSeconds}s] ${(await page.locator("ol > li").allInnerTexts()).at(-1)}`);
    if (await page.getByRole("link", { name: "Back to your plan" }).count()) {
      reFinished = true;
      break;
    }
  }
  check("the reopened conversation finishes again", reFinished);

  // The card says how many sittings were re-worked, and that number comes
  // straight from what applyRevision actually moved -- so a nonzero one is the
  // write path reporting on itself.
  const told = await page.locator("main").innerText();
  check(
    "it says how many sittings were re-worked",
    /sittings? you haven't started yet (has|have) been re-worked/i.test(told),
    (told.match(/The [^.]*re-worked[^.]*\./) ?? [""])[0],
  );
  await shot(page, "6-recut-told");

  const now = await planRows();
  check("the plan still has the same sittings", now.length === was.length, `${was.length} → ${now.length}`);
  // The point of the whole thing: finishing it again re-estimates what hasn't
  // been started. If this fails, the revision never reached the database.
  check(
    "the sittings were re-estimated from the fuller picture",
    minutesOf(now) !== minutesOf(was),
    `${minutesOf(was)} → ${minutesOf(now)}`,
  );
  // The slots stay put and the sittings move between them, so remembering
  // something doesn't rearrange somebody's month.
  check("the dates stayed where they were", datesOf(now) === datesOf(was), datesOf(was));
  console.log(`\nPLAN BEFORE: ${titlesOf(was)}\nPLAN AFTER:  ${titlesOf(now)}`);
  await shot(page, "6-plan-recut");

  // ── And it won't reopen over an open sitting ────────────────────────
  await page.getByRole("button", { name: "Start now" }).first().click();
  await page.waitForURL(/\/sitting$/, { timeout: 30_000, waitUntil: "commit" });
  await page.goto(`${BASE}/start/intake`);
  await page.getByRole("button", { name: "Add something to this" }).click();
  // The composer keeps an empty alert slot, so take the one with words in it.
  const refusal = page.locator("[role=alert]").filter({ hasText: /\S/ }).first();
  await refusal.waitFor({ timeout: 15_000 });
  const said = await refusal.innerText();
  check("reopening is refused while a sitting is open", /finish the sitting/i.test(said), said);
}

// ── Account B: can't reach A's record ─────────────────────────────────
const b = await browser.newContext();
const pageB = await signUp(b, "Other Person", `e2e-other-${stamp}@example.test`);
for (const path of ["/plan", "/plan/new", "/start/intake"]) {
  await pageB.goto(`${BASE}${path}`);
  check(`other account at ${path} is sent to its own /start`, pageB.url().endsWith("/start"));
}
const res = await pageB.request.post(`${BASE}/api/intake/message`, { data: { text: "hello", speaker: "Margaret" } });
check("other account can't post to the conversation", res.status() === 404, `status ${res.status()}`);
const anon = await browser.newContext();
const resAnon = await anon.request.post(`${BASE}/api/intake/message`, { data: { text: "hello", speaker: "x" } });
check("signed-out post is refused", resAnon.status() === 401, `status ${resAnon.status()}`);

await browser.close();
console.log(`\nE2E_EMAIL_A=${emailA}`);
console.log(`RESULT: ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed`);
console.log("TRANSCRIPT_JSON=" + JSON.stringify(transcript));
