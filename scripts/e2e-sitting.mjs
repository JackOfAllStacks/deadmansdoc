// Browser end-to-end: sign-up → opening conversation → plan → one whole sitting.
//
// Talks to the real Claude API: roughly 35 model calls, so not something to
// run in a loop. It creates an …@example.test account that should be deleted
// afterwards.
//
// Needs a running server on the dev database, and Playwright's browser
// (npx playwright install chromium --only-shell) once.
//
// Usage: node scripts/e2e-sitting.mjs <base-url> <signup-code> [screenshot-dir]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { parse } from "yaml";

const [BASE = "http://localhost:3000", CODE, SHOTS = "."] = process.argv.slice(2);
const stamp = Date.now();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// John's own words, read from his persona file so the thing that is tested and
// the thing scripts/demo-run.mjs demonstrates can't drift apart. Deliberately
// rambly, and full of the shapes the tools have to cope with.
const persona = parse(readFileSync(join(process.cwd(), "data", "personas", "john.yaml"), "utf8"));
const INTAKE = persona.script.intake.map((l) => [l.who, l.says.replace(/\s+/g, " ").trim()]);
const SITTING = persona.script.sittings.people.map((l) => [l.who, l.says.replace(/\s+/g, " ").trim()]);

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
// A conversation that hasn't started opens on what it's for, not on the box.
await page.getByRole("button", { name: "Start the conversation" }).click();
await page.getByLabel("Your answer").waitFor();

// ── The opening conversation ──────────────────────────────────────────
async function say(speaker, text, doneText) {
  // The segmented control's radio is sr-only and its label sits over it, so a
  // real person clicks the label. Checking the input directly is what a person
  // can't do, and Playwright rightly refuses it.
  await page
    .locator("label")
    .filter({ has: page.locator('input[name="speaker"]') })
    .filter({ hasText: new RegExp(`^${speaker}$`) })
    .click();
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
check("dates read as a suggestion", /the order is a suggestion like the dates are/i.test(await page.locator("main").innerText()));
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
// The document is there from the start -- headings with nothing under them,
// room waiting to be written in -- so "empty" means nothing recorded, not an
// empty panel.
const panel = await page.locator("aside").innerText();
check("the document starts with nothing recorded in it", /0 recorded of \d+/.test(panel), (panel.match(/\d+ recorded of \d+/) ?? [""])[0]);

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
  // The plan's summary reads "Done / 1 of 4" since the stats went in.
  check("the plan shows it done", /Done\s+1 of \d+/i.test(planText), (planText.match(/Done\s+\d+ of \d+/i) ?? [""])[0]);
  await shot("4-plan-after");
}

console.log(`\nE2E_EMAIL=${email}`);
console.log(`RESULT: ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed`);
await browser.close();
