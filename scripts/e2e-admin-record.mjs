// Browser end-to-end for the admin view of a record: the list, the record
// itself, both documents, and the completeness check.
//
// Expects a record that already has something in it — run scripts/e2e-sitting.mjs
// first, then `npm run make-admin -- <that account>` so it can see the page.
// The completeness check is one model call, so this costs a little.
//
// Usage: node scripts/e2e-admin-record.mjs <base-url> <admin-email> [screenshot-dir]
import { chromium } from "playwright";

const [BASE = "http://localhost:3000", EMAIL, SHOTS = "."] = process.argv.slice(2);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();

await page.goto(`${BASE}/sign-in`);
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password").fill("correct-horse-battery");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30_000, waitUntil: "commit" });

await page.goto(`${BASE}/admin`);
await page.getByRole("heading", { name: "Admin", exact: true }).waitFor();
check("records are listed", (await page.locator("a[href^='/admin/records/']").count()) >= 1);

await page.locator("a[href^='/admin/records/']").first().click();
await page.waitForURL(/\/admin\/records\/[0-9a-f-]+$/, { timeout: 30_000, waitUntil: "commit" });
const detail = await page.locator("main").innerText();
check("the record page names the subject", detail.includes("John"));
check("every in-scope section is shown", [1, 2, 3, 5].every((n) => detail.includes(`Section ${n} —`)));
check("captured values appear", /What to do:/.test(detail));
// innerText reflects text-transform, and that label is styled uppercase.
check("the transcript is there", /opening conversation/i.test(detail));
check("coverage is shown before any model call", /\d+ of 54/.test(detail), detail.match(/\d+ of 54[^\n]*/)?.[0]);
await page.screenshot({ path: `${SHOTS}/8-admin-record.png`, fullPage: true });

// ── The Guide ─────────────────────────────────────────────────────────
const recordUrl = page.url();
await page.getByRole("link", { name: "The Guide" }).click();
await page.waitForURL(/\/guide$/, { timeout: 30_000, waitUntil: "commit" });
const guide = await page.locator("pre").innerText();
check("the Guide has a title and front matter", guide.startsWith("# The Guide"));
check("it says it isn't a will", guide.includes("not a will"));
check("every in-scope section prints a heading", [1, 2, 3, 5].every((n) => guide.includes(`## Section ${n} —`)));
check("it tells the family about the envelope", /sealed envelope/i.test(guide));
check("recorded people appear", /\*\*Jack\*\*|\*\*Robyn\*\*/.test(guide));
check("it can be downloaded", (await page.locator("a[download]").count()) === 1);
console.log("\n--- GUIDE (first 60 lines) ---\n" + guide.split("\n").slice(0, 60).join("\n"));
await page.screenshot({ path: `${SHOTS}/9-guide.png`, fullPage: true });

// Rendering is deterministic: same record, same document.
await page.reload();
const guideAgain = await page.locator("pre").innerText();
check("the same record renders the same document", guide === guideAgain);

// ── The Envelope ──────────────────────────────────────────────────────
await page.goto(recordUrl);
await page.getByRole("link", { name: /Sealed Envelope|No envelope/ }).click();
await page.waitForURL(/\/envelope$/, { timeout: 30_000, waitUntil: "commit" });
const envelopeText = await page.locator("main").innerText();
const hasEnvelope = (await page.locator("pre").count()) === 1;
if (hasEnvelope) {
  const envelope = await page.locator("pre").innerText();
  check("the envelope stands on its own", envelope.includes("John") && /Prepared:/.test(envelope));
  check("it says when it is opened", /opened only after/i.test(envelope));
  check("it holds only sealed things", !envelope.includes("_What to do: Call Jack"));
  console.log("\n--- ENVELOPE ---\n" + envelope);
} else {
  check("it explains why there is no envelope", envelopeText.includes("no envelope prints"));
}
await page.screenshot({ path: `${SHOTS}/10-envelope.png`, fullPage: true });

// ── The completeness check ────────────────────────────────────────────
await page.goto(recordUrl);
const before = (await page.locator("main").innerText()).match(/(\d+) of 54/)?.[1];
await page.getByRole("button", { name: "Check what's left" }).click();
await page.waitForFunction(
  () => {
    const b = [...document.querySelectorAll("button")].find((x) => /Check what's left|Reading the/.test(x.textContent ?? ""));
    return b && !/Reading the/.test(b.textContent ?? "");
  },
  null,
  { timeout: 180_000 },
);
const after = await page.locator("main").innerText();
check("the check runs and reports", /don't apply|not covered yet/.test(after));
const applies = after.match(/(\d+) don't apply/)?.[1];
console.log(`coverage before: ${before} of 54 · items judged not to apply: ${applies}`);
check("reasons are available", (await page.getByText("Why each one").count()) === 1);
await page.getByText("Why each one").click();
const reasons = await page.locator("details ul li").allInnerTexts();
console.log("\n--- SAMPLE REASONS ---\n" + reasons.slice(0, 6).map((r) => "  - " + r.replace(/\n/g, " | ")).join("\n"));
await page.screenshot({ path: `${SHOTS}/11-completeness.png`, fullPage: true });

console.log(`\nRESULT: ${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed`);
await browser.close();
