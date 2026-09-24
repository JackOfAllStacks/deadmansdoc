"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CapturedItem } from "@/lib/sitting/capture";
import type { Coverage } from "@/lib/sitting/coverage";
import type { SittingEvent } from "@/lib/sitting/agent";
import type { ChatMessage } from "@/lib/transcript";

type Status = "idle" | "sending" | "finished" | "catching-up";
type Progress = Pick<Coverage, "answered" | "gaps" | "total">;

const KIND_LABEL: Record<CapturedItem["kind"], string> = {
  field: "Recorded",
  entity: "Added",
  amount: "Sealed",
  gap: "Not known",
  note: "Noted",
};

export function SittingChat({
  greeting,
  history,
  captured,
  coverage,
  speakers,
  maxLength,
  busy,
}: {
  greeting: string;
  history: ChatMessage[];
  captured: CapturedItem[];
  coverage: Coverage;
  speakers: string[];
  maxLength: number;
  busy: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(history);
  const [items, setItems] = useState<CapturedItem[]>(captured);
  const [progress, setProgress] = useState<Progress>(coverage);
  const [live, setLive] = useState("");
  const [draft, setDraft] = useState("");
  const [speaker, setSpeaker] = useState(speakers[0]);
  const [status, setStatus] = useState<Status>(busy ? "catching-up" : "idle");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, live, status]);

  // Opened while a reply was still being written -- which happens if someone
  // reloads or comes back on another tab. The turn finishes on the server
  // either way, so wait for it and then pick up what it saved.
  useEffect(() => {
    if (status !== "catching-up") return;
    let stop = false;
    const tick = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, 2000));
        if (stop) return;
        try {
          const res = await fetch("/api/sitting/state", { cache: "no-store" });
          const body = await res.json();
          if (!body.busy) {
            router.refresh();
            setStatus("idle");
            return;
          }
        } catch {
          // Offline or the page is going away; try again on the next tick.
        }
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [status, router]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || status !== "idle") return;

    setError(null);
    setStatus("sending");
    setDraft("");
    const mine: ChatMessage = { from: "person", name: speaker, text };
    setMessages((m) => [...m, mine]);

    const restore = (message: string) => {
      setMessages((m) => m.filter((x) => x !== mine));
      setDraft(text);
      setError(message);
    };

    let reply = "";
    let outcome: "end" | "done" | "error" | null = null;
    try {
      const res = await fetch("/api/sitting/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, speaker }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        restore(body.error ?? "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as SittingEvent;
          if (e.type === "text") {
            reply += e.text;
            setLive(reply);
          } else if (e.type === "reset") {
            reply = "";
            setLive("");
          } else if (e.type === "saved") {
            // The same entry gets added to more than once as details come out,
            // and each one is an update rather than another row.
            setItems((list) => {
              const item = { kind: e.kind, label: e.label, detail: e.detail };
              const at = list.findIndex((x) => x.kind === item.kind && x.label === item.label);
              if (at === -1) return [...list, item];
              const next = [...list];
              next[at] = { ...item, detail: item.detail ?? next[at].detail };
              return next;
            });
          } else if (e.type === "progress") {
            setProgress({ answered: e.answered, gaps: e.gaps, total: e.total });
          } else if (e.type === "error") {
            outcome = "error";
            if (e.kept) setError(e.message);
            else restore(e.message);
          } else if (e.type === "done") {
            outcome = "done";
            setSummary(e.summary);
          } else {
            outcome = e.type;
          }
        }
      }
    } catch {
      restore("The connection dropped. Please send that again.");
      setLive("");
      setStatus("idle");
      return;
    }

    if (reply.trim()) setMessages((m) => [...m, { from: "agent", text: reply.trim() }]);
    setLive("");
    if (outcome === "done") {
      setStatus("finished");
    } else {
      if (outcome === null) setError("The reply was cut short. Please send your message again.");
      setStatus("idle");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <ol aria-live="polite" aria-label="Conversation" className="flex flex-col gap-4">
          <Bubble message={{ from: "agent", text: greeting }} />
          {messages.map((m, i) => (
            <Bubble key={i} message={m} />
          ))}
          {(status === "sending" || status === "catching-up") && (
            <Bubble message={{ from: "agent", text: live }} pending={!live} />
          )}
        </ol>
        <div ref={endRef} />

        {status === "finished" ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-foreground/15 p-4">
            <p className="font-medium">That&apos;s this sitting done.</p>
            {summary && <p className="text-sm text-foreground/70">{summary}</p>}
            <Link href="/plan" className="rounded-md bg-foreground px-4 py-2.5 font-medium text-background">
              Back to your plan
            </Link>
          </div>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-3">
            {speakers.length > 1 && (
              <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <legend className="sr-only">Who is typing?</legend>
                <span className="text-foreground/60">Who&apos;s typing:</span>
                {speakers.map((name) => (
                  <label key={name} className="flex items-center gap-1.5">
                    <input type="radio" name="speaker" checked={speaker === name} onChange={() => setSpeaker(name)} />
                    {name}
                  </label>
                ))}
              </fieldset>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              maxLength={maxLength}
              rows={3}
              placeholder="Type your answer…"
              aria-label="Your answer"
              className="resize-y rounded-md border border-foreground/20 bg-background px-3 py-2 text-base outline-none focus:border-foreground/60 focus:ring-2 focus:ring-foreground/10"
            />
            {error && (
              <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/plan" className="text-sm text-foreground/60 underline">
                Stop for now
              </Link>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-foreground/50 sm:inline">Enter to send</span>
                <button
                  type="submit"
                  disabled={status !== "idle" || !draft.trim()}
                  className="rounded-md bg-foreground px-4 py-2.5 font-medium text-background transition-opacity disabled:opacity-50"
                >
                  {status === "idle" ? "Send" : "Waiting…"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <CapturePanel items={items} progress={progress} />
    </div>
  );
}

function CapturePanel({ items, progress }: { items: CapturedItem[]; progress: Progress }) {
  const done = progress.answered + progress.gaps;
  return (
    <aside className="flex h-fit flex-col gap-3 rounded-md border border-foreground/15 p-4 lg:sticky lg:top-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-medium">What we&apos;ve recorded</h2>
        <p className="text-sm text-foreground/60">
          {progress.answered} answered
          {progress.gaps > 0 && `, ${progress.gaps} to find out`} of {progress.total}
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-foreground/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={done}
          aria-label="Recorded so far"
        >
          <div
            className="h-full bg-foreground transition-[width] duration-500"
            style={{ width: `${progress.total ? (done / progress.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {items.length ? (
        <ol className="flex flex-col gap-2 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex flex-col gap-0.5 border-t border-foreground/10 pt-2">
              <span className="text-xs uppercase tracking-wide text-foreground/40">{KIND_LABEL[item.kind]}</span>
              <span>{item.label}</span>
              {item.detail && <span className="text-foreground/60">{item.detail}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-foreground/60">
          Things will appear here as you talk. Nothing is written down until you say it.
        </p>
      )}
    </aside>
  );
}

function Bubble({ message, pending = false }: { message: ChatMessage; pending?: boolean }) {
  const isAgent = message.from === "agent";
  return (
    <li className={`flex flex-col gap-1 ${isAgent ? "items-start" : "items-end"}`}>
      {!isAgent && message.name && <span className="text-xs text-foreground/50">{message.name}</span>}
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-3 leading-relaxed ${
          isAgent ? "bg-foreground/5" : "bg-foreground text-background"
        }`}
      >
        {pending ? <span className="text-foreground/50">…</span> : message.text}
      </div>
    </li>
  );
}
