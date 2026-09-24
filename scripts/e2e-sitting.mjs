// Browser end-to-end: sign-up → opening conversation → plan → one whole sitting.
//
// Talks to the real Claude API. A run is roughly 35 model calls and costs
// about US$0.40–0.60, so it is not something to run in a loop. It creates an
// …@example.test account that should be deleted afterwards.
//
// Needs a running server on the dev database, and Playwright's browser
// (npx playwright install chromium --only-shell) once.
//
// Usage: node scripts/e2e-sitting.mjs <base-url> <signup-code> [screenshot-dir]
import { chromium } from "playwright";

const [BASE = "http://localhost:3000", CODE, SHOTS = "."] = process.argv.slice(2);
const stamp = Date.now();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// John, 73, semi-retired builder, with his son Jack. Same persona as the demo
// script, trimmed for the opening conversation.
const INTAKE = [
  ["Jack", "There's Dad, my brother Michael in Brisbane and me. Mum died two years ago. Dad's also got his brother Terry and his sister Robyn. Honestly the thing he's worried about is what's owed on the units and the rent that keeps coming in after he's gone."],
  ["John", "Everyday account and savings with NAB, two term deposits, the share portfolio through CommSec, and the company account with Westpac. I've done all of it myself since Denise passed."],
  ["John", "There's the building company, still ticking over, and the family trust that owns two units in Frankston. No mortgage on the house. There's a loan on the ute and an overdraft on the company, and I lent my nephew Trent forty grand on a handshake."],
  ["Jack", "Dad's got an accountant, Peter, a solicitor called Gail who did the will, and a bloke who looks after his super."],
  ["John", "The rent from the units would keep coming in, and a couple of final invoices the builders still owe me."],
  ["John", "We're not religious. I'd like the RSL to do a short service, and cremation's fine. There's no rush."],
  ["Jack", "One of the units is on the market right now, and there's an insurance claim for the roof dragging on since March."],
  ["Jack", "I think that covers it."],
  ["Jack", "Yes, that's everything for today, thanks."],
];

// Answers for the sitting itself. Deliberately rambly and full of the shapes
// the tools have to cope with: people, a list, an ordered sequence, a gap, and
// a figure that should end up sealed.
const SITTING = [
  ["Jack", "The first person to call would be me. Then Michael in Brisbane, though he'd take a day to get here. And Dad's sister Robyn — she's the one who'd actually organise people."],
  ["John", "Robyn's on 0412 555 010. Jack you've got my phone. Michael's number I never remember, it's in the phone under Mick."],
  ["Jack", "Peter the accountant handles the company books and the trust. Gail did the will. If it's anything about money, Peter's the first call — Dad wouldn't want us ringing the bank ourselves."],
  ["John", "Robyn and Michael have never met properly, only at the funeral. They'd clash. Jack, you'd have to be the one in the middle."],
  ["John", "Nobody's been told any of this, really. Jack knows some of it. Michael knows none of it."],
  ["Jack", "Actually — don't let anyone ring Trent about the forty grand straight away. That'd cause a blue at exactly the wrong moment."],
  ["John", "I honestly don't know who'd look after the company if I went. Peter would know what needs doing, I suppose."],
  ["Jack", "I think that's the people covered."],
  ["Jack", "Yes, let's stop there for today."],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
const email = `e2e-sitting-${stamp}@example.test`;

const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

// ── Sign up and start ─────────────────────────────────────────────────
await page.goto(`${BASE}/sign-up`);
await page.getByLabel("Your name").fill("Jack");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("correct-horse-battery");
await page.getByLabel("Access code").fill(CODE);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(/\/start$/, { timeout: 30_000, waitUntil: "commit" });

await page.getByLabel("My parent").check();
await page.getByLabel("Their first name").fill("John");
await page.getByLabel("Who's here today?").fill("Jack, John");
await page.getByLabel(/I understand this is not a will/).check();
await page.getByLabel(/happy to begin/).check();
await page.getByRole("button", { name: "Begin" }).click();
await page.waitForURL(/\/start\/intake$/, { timeout: 30_000, waitUntil: "commit" });
await page.getByLabel("Your answer").waitFor();

// ── The opening conversation ──────────────────────────────────────────
async function say(speaker, text, doneText) {
  await page.getByLabel(speaker, { exact: true }).check();
  await page.getByLabel("Your answer").fill(text);
  // The button only enables once React has the typed value. Clicking before
  // that lands on unhydrated HTML and does nothing at all.
  const sendButton = () =>
    [...document.querySelectorAll("button")].find((b) => /^(Send|Waiting…)$/.test(b.textContent ?? ""));
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /^(Send|Waiting…)$/.test(x.textContent ?? ""));
    return b instanceof HTMLButtonElement && !b.disabled && b.textContent === "Send";
  }, null, { timeout: 30_000 });
  void sendButton;
  const started = Date.now();
  await page.getByRole("button", { name: "Send" }).click();
  // Confirm it actually started, rather than assuming.
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent === "Waiting…"),
    null,
    { timeout: 30_000 },
  );
  await page.waitForFunction(
    (text) => {
      const btn = [...document.querySelectorAll("button")].find((b) => /^(Send|Waiting…)$/.test(b.textContent ?? ""));
      const finished = [...document.querySelectorAll("a")].some((a) => a.textContent?.trim() === text);
      return finished || (btn && btn.textContent === "Send");
    },
    doneText,
    { timeout: 180_000 },
  );
  // The pending bubble is replaced in the same render the button returns in;
  // read after it has gone or every reply looks like an ellipsis.
  await page
    .waitForFunction(
      () => ![...document.querySelectorAll("main ol > li")].some((li) => li.textContent?.trim() === "…"),
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});
  return ((Date.now() - started) / 1000).toFixed(1);
}

let intakeDone = false;
for (const [speaker, text] of INTAKE) {
  const secs = await say(speaker, text, "See your plan");
  const last = (await page.locator("main ol").first().locator("> li").allInnerTexts()).at(-1);
  console.log(`\n[${speaker}] ${text}\n[agent, ${secs}s] ${last}`);
  if (await page.getByRole("link", { name: "See your plan" }).count()) {
    intakeDone = true;
    break;
  }
}
check("opening conversation finishes", intakeDone);

// ── The plan ──────────────────────────────────────────────────────────
await page.getByRole("link", { name: "See your plan" }).click();
await page.waitForURL(/\/plan\/new$/, { waitUntil: "commit" });
await page.locator("section ol > li").first().waitFor();
const preview = await page.locator("section ol > li").allInnerTexts();
console.log("\nPLAN:\n" + preview.map((c) => "  - " + c.replace(/\n/g, " | ")).join("\n"));
await page.getByRole("button", { name: "Use this plan" }).click();
await page.waitForURL(/\/plan$/, { timeout: 30_000, waitUntil: "commit" });
await page.locator("main ol > li").first().waitFor();

const startButtons = await page.getByRole("button", { name: "Start now" }).count();
check("every planned sitting can be started", startButtons >= 4, `${startButtons} buttons`);
check("dates read as a suggestion", (await page.locator("main").innerText()).includes("Suggested for"));
await shot("1-plan");

// ── The sitting ───────────────────────────────────────────────────────
// Deliberately not the first one on the plan: the dates and the order are a
// suggestion, and any sitting should be startable.
const peopleRow = page.locator("main ol > li").filter({ hasText: "The people around you" });
check("a later sitting can be started out of order", (await peopleRow.count()) === 1);
await peopleRow.getByRole("button", { name: "Start now" }).click();
await page.waitForURL(/\/sitting$/, { timeout: 30_000, waitUntil: "commit" });
await page.getByLabel("Your answer").waitFor();
check("a sitting starts from the plan", page.url().endsWith("/sitting"));
check("the panel starts empty", (await page.locator("aside").innerText()).includes("Things will appear here"));

let sittingDone = false;
let reloaded = false;
for (const [i, [speaker, text]] of SITTING.entries()) {
  const secs = await say(speaker, text, "Back to your plan");
  const bubbles = await page.locator("ol[aria-label='Conversation'] > li").allInnerTexts();
  const panel = await page.locator("aside").innerText();
  console.log(`\n[${speaker}] ${text}\n[agent, ${secs}s] ${bubbles.at(-1)}`);
  console.log(`[panel] ${panel.replace(/\n+/g, " | ")}`);

  if (i === 2 && !reloaded) {
    reloaded = true;
    const before = await page.locator("aside li").allInnerTexts();
    const beforeChat = await page.locator("ol[aria-label='Conversation'] > li").count();
    await page.reload();
    await page.getByLabel("Your answer").waitFor({ timeout: 60_000 });
    const after = await page.locator("aside li").allInnerTexts();
    const afterChat = await page.locator("ol[aria-label='Conversation'] > li").count();
    check("the conversation survives a reload", afterChat === beforeChat, `${beforeChat} → ${afterChat} messages`);
    check("what was recorded survives a reload", after.length > 0, `${before.length} shown → ${after.length} stored`);
    await shot("2-sitting");
  }
  if (await page.getByRole("link", { name: "Back to your plan" }).count()) {
    sittingDone = true;
    break;
  }
}
check("the sitting finishes", sittingDone);
await shot("3-sitting-done");

const captured = await page.locator("aside li").allInnerTexts();
check("things were recorded during the sitting", captured.length > 0, `${captured.length} items`);
console.log("\nCAPTURED:\n" + captured.map((c) => "  - " + c.replace(/\n/g, " | ")).join("\n"));

if (sittingDone) {
  await page.getByRole("link", { name: "Back to your plan" }).click();
  await page.waitForURL(/\/plan$/, { timeout: 30_000, waitUntil: "commit" });
  const planText = await page.locator("main").innerText();
  check("the plan shows it done", /1 of \d+ sittings done/.test(planText), planText.split("\n")[1]);
  await shot("4-plan-after");
}

console.log(`\nE2E_EMAIL=${email}`);
console.log(`RESULT: ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed`);
await browser.close();
