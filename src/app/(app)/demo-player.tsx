"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { endDemoRun } from "@/app/(app)/actions";
import type { DemoRun } from "@/lib/demo/run";
import type { ScriptLine } from "@/lib/demo/personas";
import { cx } from "@/components/ui";

/*
 * Plays a persona's words into the real pages, from inside the browser that is
 * watching. It is scripts/demo-run.mjs without Playwright: it finds things the
 * way a person would -- by their label, by what the button says -- and clicks
 * them. The pages don't know it's there, so there is no special path through
 * the app: if this works, the product works, and if it stalls, so would a
 * person.
 *
 * It works out what to do next from the page it's on rather than from a step
 * counter, so a reload or a wrong turn picks up where things actually are.
 */

/** Pause before each line, so whoever is watching can read the reply. */
const PACE = 2500;
/** Per character. The script typed at about 16ms; this is half as fast again. */
const TYPE_MS = 11;
/** How long a model turn may take before the run gives up on it. */
const TURN_LIMIT = 180_000;

const RELATIONSHIP = { self: "Myself", parent: "My parent", other: "Someone else close to me" } as const;

const QUIET = "text-muted underline underline-offset-4 hover:text-ink";

class Cancelled extends Error {}

type Status = { text: string; tone?: "done" | "stuck" };

// ── Finding things the way a person would ─────────────────────────────

const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const outsidePlayer = (el: Element) => !el.closest("[data-demo-player]");

function button(name: string | RegExp, within: ParentNode = document): HTMLButtonElement | null {
  const match = (t: string) => (typeof name === "string" ? t === name : name.test(t));
  return ([...within.querySelectorAll("button")].find((b) => outsidePlayer(b) && match(text(b))) ?? null);
}

function link(name: string, within: ParentNode = document): HTMLAnchorElement | null {
  return [...within.querySelectorAll("a")].find((a) => outsidePlayer(a) && text(a) === name) ?? null;
}

/** The control inside a label, matched on the label's own words. */
function labelled(name: string | RegExp): HTMLInputElement | null {
  const match = (t: string) => (typeof name === "string" ? t === name : name.test(t));
  const label = [...document.querySelectorAll("label")].find((l) => {
    if (!outsidePlayer(l)) return false;
    const own = l.querySelector("span");
    return match(text(l)) || (own !== null && match(text(own)));
  });
  return label?.querySelector("input") ?? null;
}

/** The plan's heading is "John's plan" or "Your plan"; nothing else ends that way. */
const onPlan = () => /plan$/i.test(text(document.querySelector("main h1") ?? document.createElement("i")));

const answerBox = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Your answer"]');

/** Idle means the composer is there and isn't waiting on a reply. */
function composerIdle(): boolean {
  const box = answerBox();
  return box?.form?.dataset.busy === "false";
}

/** There is no send button: Enter sends, and so does submitting the form. */
const sendIt = (box: HTMLTextAreaElement) => box.form?.requestSubmit();

/**
 * React watches the native value setter, so assigning `.value` directly is
 * invisible to it. Setting it the way the browser does, then announcing it,
 * is what a keystroke looks like from React's side.
 */
function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// ── Progress, so a reload doesn't start the script again ──────────────

function readSaid(key: string): number {
  try {
    return Number(sessionStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeSaid(key: string, n: number) {
  try {
    sessionStorage.setItem(key, String(n));
  } catch {
    // Private window or storage blocked: a reload would restart the script,
    // which the conversation copes with. Nothing else depends on this.
  }
}

function readList(key: string): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, values: string[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify(values));
  } catch {
    // As above: without storage a reload forgets, and nothing else breaks.
  }
}

/** Kept with the sittings left behind, since it's the same kind of fact: where the run has been. */
const ENDING = "(the guide)";

export function DemoPlayer({ run }: { run: DemoRun }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ text: "Starting" });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  // The layout hands over a fresh object whenever it re-renders, which a
  // server action does. Keyed on the content, so that isn't a restart.
  const script = JSON.stringify(run);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const run = JSON.parse(script) as DemoRun;
    let cancelled = false;

    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        setTimeout(() => (cancelled ? reject(new Cancelled()) : resolve()), ms);
      });
    // Waits out a pause as well as the time, so Pause takes effect between
    // any two steps -- including part-way through typing a line.
    const wait = async (ms: number) => {
      await sleep(ms);
      while (pausedRef.current) await sleep(200);
    };
    const until = async <T,>(find: () => T | null | false, limit = 40_000): Promise<T> => {
      const started = Date.now();
      for (;;) {
        const found = find();
        if (found) return found;
        if (Date.now() - started > limit) throw new Error("timed out");
        await sleep(200);
      }
    };

    const type = async (el: HTMLInputElement | HTMLTextAreaElement, words: string) => {
      el.focus();
      setValue(el, "");
      for (let i = 1; i <= words.length; i++) {
        setValue(el, words.slice(0, i));
        await wait(TYPE_MS);
      }
    };

    const check = async (name: string | RegExp) => {
      const box = await until(() => labelled(name));
      if (!box.checked) box.click();
      await wait(300);
    };

    /** One exchange: who is speaking, what they say, and Send. */
    const speak = async ({ who, says }: ScriptLine) => {
      const speaker = [...document.querySelectorAll('input[name="speaker"]')]
        .map((input) => input.closest("label"))
        .find((label) => label && text(label) === who);
      speaker?.click();
      const box = await until(answerBox);
      await type(box, says.replace(/\s+/g, " ").trim());
      await wait(400);
      sendIt(box);
      // Out of idle first, so the next look round doesn't see the moment
      // before the click landed and type the following line over it.
      await until(() => !composerIdle(), 5_000).catch(() => {});
    };

    /**
     * The next line of a conversation, or false once the script is spent.
     * Counted at the moment it's sent; a line the page hands back after a
     * failure is still in the box, and goes again rather than being skipped.
     */
    const nextLine = async (key: string, lines: ScriptLine[], label: string) => {
      const box = answerBox();
      if (box?.value.trim()) {
        setStatus({ text: "Sending that again" });
        await wait(PACE);
        sendIt(box);
        await until(() => !composerIdle(), 5_000).catch(() => {});
        return true;
      }
      const said = readSaid(key);
      if (said >= lines.length) return false;
      await wait(PACE);
      setStatus({ text: `${label}: line ${said + 1} of ${lines.length}` });
      writeSaid(key, said + 1);
      await speak(lines[said]);
      return true;
    };

    // Ending the run clears its cookie, and the layout drops this panel with
    // it -- which at the Guide is the right ending. Stuck, it stays: the
    // message is the point, and Stop is still there.
    const finish = async () => {
      setStatus({ text: "Done.", tone: "done" });
      await endDemoRun().catch(() => {});
      router.refresh();
    };

    /** Which script a sitting's title belongs to; a long one is split into "(part 1 of 2)". */
    const scriptFor = (title: string) => run.sittings.find((s) => title.includes(s.title));

    // The Guide is where a run ends, but only once it has been taken there:
    // somebody clicking through to look mid-run shouldn't stop it.
    const toGuide = async () => {
      writeList(`demo:${run.id}:left`, [...readList(`demo:${run.id}:left`), ENDING]);
      const guide = link("The Guide");
      if (guide) guide.click();
      else router.push("/guide");
      await until(() => window.location.pathname === "/guide");
    };

    async function step(): Promise<"again" | "done"> {
      const path = window.location.pathname;

      if (path === "/start") {
        setStatus({ text: "Consent, and who's in the room" });
        const choice = await until(() => labelled(RELATIONSHIP[run.relationship]));
        await wait(PACE / 2);
        choice.click();
        await wait(400);
        if (run.relationship !== "self") {
          await type(await until(() => labelled("Their first name")), run.subjectName);
          await wait(400);
        }
        await type(await until(() => labelled("Who's here today?")), run.present.join(", "));
        await wait(600);
        await check(/I understand this is not a will/);
        await check(/happy to begin/);
        await wait(PACE);
        button("Begin")?.click();
        await until(() => window.location.pathname !== "/start");
        return "again";
      }

      if (path === "/start/intake") {
        const toPlan = link("See your plan");
        if (toPlan) {
          setStatus({ text: "The opening conversation is done" });
          await wait(PACE);
          toPlan.click();
          await until(() => window.location.pathname !== "/start/intake");
          return "again";
        }
        const start = button("Start the conversation");
        if (start) {
          setStatus({ text: "The opening conversation" });
          await wait(PACE);
          start.click();
          await until(answerBox);
          return "again";
        }
        if (!composerIdle()) {
          // The model closes the conversation when it has enough, which can be
          // before the script runs out -- and then the composer never comes back.
          setStatus({ text: "Waiting for the reply" });
          await until(() => composerIdle() || link("See your plan"), TURN_LIMIT);
          return "again";
        }
        if (!(await nextLine(`demo:${run.id}:intake`, run.intake, "Opening conversation"))) {
          setStatus({
            text: "The script ran out before the conversation closed itself. Carry on by hand from here.",
            tone: "stuck",
          });
          return "done";
        }
        return "again";
      }

      if (path === "/plan/new") {
        setStatus({ text: "The plan it worked out" });
        const use = await until(() => button("Use this plan"));
        await wait(PACE * 2);
        use.click();
        await until(() => window.location.pathname !== "/plan/new");
        return "again";
      }

      if (path === "/plan") {
        // The plan's own order, top to bottom, skipping anything already done
        // and anything the script ran out on -- otherwise "Carry on with this
        // one" would bring the run straight back to it.
        const left = readList(`demo:${run.id}:left`);
        const next = await until(() => {
          // The address changes before the page does, so until the plan's
          // own cards are there this could be reading the page just left --
          // whose transcript is a list too, with nothing in it to start.
          const rows = [...document.querySelectorAll("main ol > li")].filter((li) => li.querySelector("h2"));
          if (!onPlan() || !rows.length) return null;
          for (const li of rows) {
            const title = text(li.querySelector("h2") ?? li);
            const go = button("Start now", li) ?? link("Carry on with this one", li);
            if (go && scriptFor(title) && !left.includes(title)) return { go, title };
          }
          return { go: null, title: "" };
        });
        if (!next.go) {
          setStatus({ text: "That's every sitting" });
          await wait(PACE);
          await toGuide();
          return "again";
        }
        setStatus({ text: `Next: ${scriptFor(next.title)?.title}` });
        await wait(PACE);
        next.go.click();
        await until(() => window.location.pathname !== "/plan");
        return "again";
      }

      if (path === "/sitting") {
        const back = link("Back to your plan");
        if (back) {
          setStatus({ text: "That sitting is done" });
          await wait(PACE * 2);
          back.click();
          await until(() => window.location.pathname !== "/sitting");
          return "again";
        }
        // As on the plan: wait for this page, not the last one, before
        // reading which sitting it is.
        await until(() => answerBox() || button("Start the conversation"));
        const heading = text(await until(() => document.querySelector("main h1")));
        const sitting = scriptFor(heading);
        const start = button("Start the conversation");
        if (start) {
          start.click();
          await until(answerBox);
          return "again";
        }
        if (!composerIdle()) {
          setStatus({ text: "Waiting for the reply, and the document" });
          await until(() => composerIdle() || link("Back to your plan"), TURN_LIMIT);
          return "again";
        }
        if (!sitting || !(await nextLine(`demo:${run.id}:sitting:${sitting.key}`, sitting.lines, sitting.title))) {
          // Out of words with the sitting still open. Leave it as a person
          // would, and don't come back to it.
          setStatus({ text: "That's the script for this sitting" });
          writeList(`demo:${run.id}:left`, [...readList(`demo:${run.id}:left`), heading]);
          await wait(PACE);
          link("Stop for now")?.click();
          await until(() => window.location.pathname !== "/sitting");
        }
        return "again";
      }

      if (path === "/guide" && readList(`demo:${run.id}:left`).includes(ENDING)) {
        setStatus({ text: "The Guide, as it now stands" });
        await wait(PACE);
        await finish();
        return "done";
      }

      // Somewhere the run doesn't go. Wait to be taken back.
      setStatus({ text: "Paused here; go back to carry on" });
      await sleep(1000);
      return "again";
    }

    void (async () => {
      try {
        // Let the page it landed on finish rendering before touching it.
        await sleep(800);
        while ((await step()) === "again") await sleep(300);
      } catch (err) {
        if (err instanceof Cancelled) return;
        setStatus({ text: "The run got stuck. Carry on by hand, or stop it.", tone: "stuck" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [script, router]);

  async function stop() {
    setStatus({ text: "Stopping" });
    await endDemoRun().catch(() => {});
    router.refresh();
  }

  return (
    <div
      data-demo-player
      role="status"
      className={cx(
        "fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2 rounded-lg border bg-surface px-4 py-3 text-sm shadow-card",
        status.tone === "stuck" ? "border-outstanding" : "border-line-strong",
      )}
    >
      <p className="text-xs font-medium tracking-wide text-faint uppercase">
        Demo run · {run.name}
      </p>
      <p className={status.tone === "stuck" ? "text-outstanding" : "text-ink"}>
        {paused ? `Paused · ${status.text}` : status.text}
      </p>
      <div className="flex gap-4">
        {status.tone !== "stuck" && (
          <button type="button" onClick={() => setPaused((p) => !p)} className={QUIET}>
            {paused ? "Resume" : "Pause"}
          </button>
        )}
        <button type="button" onClick={stop} className={QUIET}>
          Stop the run
        </button>
      </div>
    </div>
  );
}
