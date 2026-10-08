// Watch the product being used, rather than being shown what it produced.
//
// /admin/demo fills an account with a finished record in about a second and
// for nothing. What it can't show is the experience — the conversation
// actually happening, the document filling in as somebody talks. This plays a
// persona's own words into the real endpoints at a pace you can follow, so a
// demo can show that without anyone improvising answers live.
//
// It goes through the real pages and the real agents. There is no special
// path: if this works, the product works, and if it stalls, so would a person.
//
// The same run can be started from /admin/demo, where it plays inside the
// browser instead (src/app/(app)/demo-player.tsx) and so works on Netlify too.
// This stays for checking it from a terminal, headless.
//
// It costs API credit — roughly US$0.20 for the opening conversation and one
// sitting — so it stays a deliberate choice rather than the only way to demo.
//
// Usage:
//   node --env-file=.env.local scripts/demo-run.mjs <base-url> <signup-code> [options]
//
//   --persona <key>   whose words to use (default: john)
//   --sitting <key>   run only this sitting (default: every one scripted, in the plan's order)
//   --headless        no window, for checking it still works
//   --pace <ms>       pause before each line (default: 2500)
//   --keep            don't print the account at the end as one to delete
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { parse } from "yaml";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
const has = (name) => args.includes(`--${name}`);
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));

const [BASE = "http://localhost:3000", CODE] = positional;
const PACE = Number(flag("pace", 2500));
const HEADLESS = has("headless");
const PERSONA_KEY = flag("persona", "john");

if (!CODE) {
  console.error("Usage: node --env-file=.env.local scripts/demo-run.mjs <base-url> <signup-code> [options]");
  process.exit(1);
}

// ── The person ────────────────────────────────────────────────────────
const dir = join(process.cwd(), "data", "personas");
const personas = readdirSync(dir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => parse(readFileSync(join(dir, f), "utf8")));
const persona = personas.find((p) => p.key === PERSONA_KEY);
if (!persona) {
  console.error(`No persona called "${PERSONA_KEY}". There is: ${personas.map((p) => p.key).join(", ")}`);
  process.exit(1);
}
if (!persona.script) {
  console.error(`${persona.key} has no script. Add one under "script:" in data/personas/${persona.key}.yaml.`);
  process.exit(1);
}
const ONLY = flag("sitting", null);
const scripted = Object.entries(persona.script.sittings ?? {}).filter(([key, lines]) =>
  lines?.length && (!ONLY || key === ONLY),
);
if (!scripted.length) {
  console.error(`${persona.key} has no script for ${ONLY ? `the "${ONLY}" sitting` : "any sitting"}.`);
  process.exit(1);
}
// A row on the plan is matched to its script by title; a long sitting is
// split into "(part 1 of 2)", and both parts draw on the same lines.
const template = parse(readFileSync(join(process.cwd(), "data", "session-template.yaml"), "utf8"));
const sittingScripts = scripted.map(([key, lines]) => ({
  key,
  lines,
  title: template.sittings.find((s) => s.key === key)?.title ?? key,
}));

const stamp = Date.now();
const email = `demo-${persona.key}-${stamp}@example.test`;
const PASSWORD = "correct-horse-battery";
// Whoever is helping is the one holding the keyboard, so the account is theirs.
const helper = persona.present.find((n) => n !== persona.subject_name) ?? persona.present[0];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (line) => console.log(line);

// Not the persona's summary: that describes the record /admin/demo seeds,
// and this one starts from nothing.
say(`\nThe Handover — a record being made, from the top.`);
say(`${persona.subject_name}, with ${persona.present.filter((n) => n !== persona.subject_name).join(" and ")}.`);
say(`\nSigning in as ${helper}. Sittings: ${sittingScripts.map((s) => s.key).join(", ")}. Account: ${email}\n`);

const browser = await chromium.launch({ headless: HEADLESS, args: ["--window-size=1400,1000"] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();

// ── Sign up and consent ───────────────────────────────────────────────
await page.goto(`${BASE}/sign-up`);
await page.locator("input[name='name']").fill(helper);
await page.locator("input[name='email']").fill(email);
await page.locator("input[name='password']").fill(PASSWORD);
await page.locator("input[name='code']").fill(CODE);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(/\/start$/, { timeout: 40_000, waitUntil: "commit" });

const RELATIONSHIP = { self: "Myself", parent: "My parent", other: "Someone else" };
await page.getByLabel(RELATIONSHIP[persona.relationship]).check();
if (persona.relationship !== "self") {
  await page.getByLabel("Their first name").fill(persona.subject_name);
}
await page.getByLabel("Who's here today?").fill(persona.present.join(", "));
await page.getByLabel(/I understand this is not a will/).check();
await page.getByLabel(/happy to begin/).check();
await wait(PACE);
await page.getByRole("button", { name: "Begin" }).click();
await page.waitForURL(/\/start\/intake$/, { timeout: 40_000, waitUntil: "commit" });

/**
 * One exchange, typed rather than filled, so it reads as somebody talking.
 * Returns true once the conversation has closed itself.
 */
async function speak({ says }, done) {
  const box = page.getByLabel("Your answer");
  await box.click();
  // About 11ms a character once Playwright's own overhead is added: half as
  // fast again as it was, which read as slow. The in-app player matches it.
  await box.pressSequentially(says.replace(/\s+/g, " ").trim(), { delay: 7 });
  await wait(400);
  const started = Date.now();
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("button")].find((b) => /^(Send|Waiting…)$/.test(b.textContent ?? ""));
      return !btn || btn.textContent === "Send";
    },
    null,
    { timeout: 180_000 },
  );
  const transcript = page.locator("ol[aria-label='Conversation'] > li, ol > li");
  const reply = (await transcript.allInnerTexts()).at(-1) ?? "";
  say(`\n  ${who}: ${says.replace(/\s+/g, " ").trim()}`);
  say(`  → ${reply.replace(/\s+/g, " ").trim().slice(0, 240)}   [${((Date.now() - started) / 1000).toFixed(1)}s]`);
  return done ? (await done()) : false;
}

// ── The opening conversation ──────────────────────────────────────────
say("── The opening conversation ──────────────────────────────────");
await page.getByRole("button", { name: "Start the conversation" }).click();
await page.getByLabel("Your answer").waitFor();

for (const line of persona.script.intake) {
  await wait(PACE);
  const over = await speak(line, async () =>
    Boolean(await page.getByRole("link", { name: "See your plan" }).count()),
  );
  if (over) break;
}

if (!(await page.getByRole("link", { name: "See your plan" }).count())) {
  say("\n  The conversation hasn't closed itself — the script ran out first.");
  say("  Add a line or two to the persona, or carry on by hand in the window.");
  if (!HEADLESS) await wait(600_000);
  await browser.close();
  process.exit(1);
}

// ── The plan ──────────────────────────────────────────────────────────
await wait(PACE);
await page.getByRole("link", { name: "See your plan" }).click();
await page.waitForURL(/\/plan\/new$/, { timeout: 40_000, waitUntil: "commit" });
await page.locator("section ol > li").first().waitFor();
say("\n── The plan it worked out ────────────────────────────────────");
for (const card of await page.locator("section ol > li").allInnerTexts()) {
  say(`  • ${card.replace(/\s+/g, " ").trim().slice(0, 150)}`);
}
await wait(PACE * 2);
await page.getByRole("button", { name: "Use this plan" }).click();
await page.waitForURL(/\/plan$/, { timeout: 40_000, waitUntil: "commit" });
await page.locator("main ol > li").first().waitFor();
await wait(PACE);

// ── The sittings, in the plan's order ─────────────────────────────────
const said = Object.fromEntries(sittingScripts.map((s) => [s.key, 0]));
const left = new Set();
for (;;) {
  await page.waitForURL(/\/plan$/, { timeout: 40_000, waitUntil: "commit" });
  await page.locator("main ol > li").first().waitFor();
  let next = null;
  for (const li of await page.locator("main ol > li").all()) {
    const title = (await li.locator("h2").innerText()).replace(/\s+/g, " ").trim();
    const script = sittingScripts.find((s) => title.includes(s.title));
    const go = li.getByRole("button", { name: "Start now" }).or(li.getByRole("link", { name: "Carry on with this one" }));
    if (script && !left.has(title) && (await go.count())) {
      next = { go, title, script };
      break;
    }
  }
  if (!next) break;

  await wait(PACE);
  await next.go.click();
  await page.waitForURL(/\/sitting$/, { timeout: 40_000, waitUntil: "commit" });
  await page.getByRole("button", { name: "Start the conversation" }).click({ timeout: 3_000 }).catch(() => {});
  await page.getByLabel("Your answer").waitFor();

  say(`\n── ${next.title} ${"─".repeat(Math.max(3, 60 - next.title.length))}`);
  let finished = false;
  while (said[next.script.key] < next.script.lines.length) {
    await wait(PACE);
    const line = next.script.lines[said[next.script.key]++];
    finished = await speak(line, async () =>
      Boolean(await page.getByRole("link", { name: "Back to your plan" }).count()),
    );
    const panel = await page.locator("aside").innerText();
    say(`  [document] ${(panel.match(/\d+ recorded[^\n]*/) ?? [""])[0]}`);
    if (finished) break;
  }
  await wait(PACE);
  if (finished) {
    await page.getByRole("link", { name: "Back to your plan" }).click();
  } else {
    say("  The script ran out with the sitting still open; leaving it there.");
    left.add(next.title);
    await page.getByRole("link", { name: "Stop for now" }).click();
  }
}

// ── What it made ──────────────────────────────────────────────────────
await wait(PACE);
await page.goto(`${BASE}/guide`);
await page.getByRole("heading", { level: 1 }).waitFor();
say("\n── The Guide, as it now stands ───────────────────────────────");
say(
  (await page.locator("main").innerText())
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, 40)
    .map((l) => `  ${l}`)
    .join("\n"),
);

say(`\nDone. The account is ${email} — password ${PASSWORD}.`);
if (!has("keep")) say("It is an …@example.test account; delete it when you're finished with it.");
if (!HEADLESS) {
  say("\nThe window stays open for ten minutes so you can walk through it.");
  await wait(600_000);
}
await browser.close();
