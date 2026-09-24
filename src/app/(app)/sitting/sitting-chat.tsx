"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Coverage } from "@/lib/sitting/coverage";
import type { DocumentEntry, DocumentSectionView } from "@/lib/sitting/document";
import type { SittingEvent } from "@/lib/sitting/agent";
import type { ChatMessage } from "@/lib/transcript";

type Status = "idle" | "sending" | "finished" | "catching-up";
type Progress = Pick<Coverage, "answered" | "gaps" | "total">;

// Folds a "saved" event into the outline: a field already holding an entry
// with this label gets updated in place (the same person or thing mentioned
// again), anything else is a new entry, appended where it belongs.
function withSaved(outline: DocumentSectionView[], event: Extract<SittingEvent, { type: "saved" }>): DocumentSectionView[] {
  if (!event.fieldId) return outline;
  const entry: DocumentEntry = { label: event.kind === "entity" ? event.label : "", text: event.text ?? event.detail };
  return outline.map((section) => ({
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      fields: group.fields.map((field) => {
        if (field.id !== event.fieldId) return field;
        const at = field.entries.findIndex((e) => e.label === entry.label);
        const entries = at === -1 ? [...field.entries, entry] : field.entries.map((e, i) => (i === at ? entry : e));
        return { ...field, entries };
      }),
    })),
  }));
}

export function SittingChat({
  greeting,
  history,
  outline,
  notes,
  coverage,
  speakers,
  maxLength,
  busy,
}: {
  greeting: string;
  history: ChatMessage[];
  outline: DocumentSectionView[];
  notes: DocumentEntry[];
  coverage: Coverage;
  speakers: string[];
  maxLength: number;
  busy: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(history);
  const [doc, setDoc] = useState<DocumentSectionView[]>(outline);
  const [extraNotes, setExtraNotes] = useState<DocumentEntry[]>(notes);
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
            if (e.fieldId) {
              setDoc((current) => withSaved(current, e));
            } else {
              const entry: DocumentEntry = { label: e.label, text: e.text ?? e.detail };
              setExtraNotes((list) => {
                const at = list.findIndex((n) => n.label === entry.label);
                return at === -1 ? [...list, entry] : list.map((n, i) => (i === at ? entry : n));
              });
            }
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

      <DocumentPanel outline={doc} notes={extraNotes} progress={progress} />
    </div>
  );
}

// The document itself, unfolding as the conversation fills it in. Every field
// this sitting can fill is shown from the start, empty, under the same
// headers the finished Guide will use -- so what's missing is as visible as
// what's there.
function DocumentPanel({
  outline,
  notes,
  progress,
}: {
  outline: DocumentSectionView[];
  notes: DocumentEntry[];
  progress: Progress;
}) {
  const done = progress.answered + progress.gaps;
  return (
    <aside className="flex h-fit max-h-[calc(100vh-3rem)] flex-col gap-4 overflow-y-auto rounded-md border border-foreground/15 p-4 lg:sticky lg:top-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-medium">The document, so far</h2>
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

      <div className="flex flex-col gap-5 text-sm">
        {outline.map((section) => (
          <section key={section.id} className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{section.title}</h3>
            {section.groups.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-3">
                {group.title && <h4 className="font-medium text-foreground/80">{group.title}</h4>}
                <dl className="flex flex-col gap-2.5">
                  {group.fields.map((field) => (
                    <div key={field.id} className="flex flex-col gap-1 border-t border-foreground/10 pt-2">
                      <dt className="text-foreground/70">{field.label}</dt>
                      {field.entries.length ? (
                        <dd className="flex flex-col gap-1">
                          {field.entries.map((entry, ei) => (
                            <span key={ei}>
                              {entry.label && <span className="font-medium">{entry.label}</span>}
                              {entry.text ? (entry.label ? ` — ${entry.text}` : entry.text) : ""}
                            </span>
                          ))}
                        </dd>
                      ) : (
                        <dd className="text-foreground/40">Not yet covered</dd>
                      )}
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </section>
        ))}

        {notes.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Other notes</h3>
            <ul className="flex flex-col gap-1.5">
              {notes.map((note, i) => (
                <li key={i} className="border-t border-foreground/10 pt-2">
                  <span className="font-medium">{note.label}</span>
                  {note.text ? ` — ${note.text}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
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
