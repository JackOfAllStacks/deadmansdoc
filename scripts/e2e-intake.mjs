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
await page.getByLabel("Your answer").waitFor();
check("greeting names Margaret", (await page.locator("ol li").first().innerText()).includes("Margaret's"));

const transcript = [];
let finished = false;
for (const [i, [speaker, text]] of SCRIPT.entries()) {
  await page.getByLabel(speaker, { exact: true }).check();
  await page.getByLabel("Your answer").fill(text);
  const started = Date.now();
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("button")].find((b) => /^(Send|Waiting…)$/.test(b.textContent ?? ""));
      const plan = [...document.querySelectorAll("a")].some((l) => l.textContent === "See your plan");
      return plan || (btn && btn.textContent === "Send");
    },
    null,
    { timeout: 180_000 },
  );
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
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

  for (const path of ["/home", "/start", "/start/intake", "/plan/new"]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForURL(/\/plan$/, { timeout: 15_000, waitUntil: "commit" }).catch(() => {});
    check(`${path} now leads to /plan`, page.url().endsWith("/plan"));
  }
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
