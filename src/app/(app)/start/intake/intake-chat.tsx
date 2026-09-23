"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import type { IntakeEvent } from "@/lib/intake/agent";

export type ChatMessage = { from: "agent"; text: string } | { from: "person"; name: string; text: string };

type Status = "idle" | "sending" | "finished";

export function IntakeChat({
  greeting,
  history,
  speakers,
  maxLength,
}: {
  greeting: string;
  history: ChatMessage[];
  speakers: string[];
  maxLength: number;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(history);
  const [live, setLive] = useState("");
  const [draft, setDraft] = useState("");
  const [speaker, setSpeaker] = useState(speakers[0]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, live, status]);

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
      const res = await fetch("/api/intake/message", {
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
          const e = JSON.parse(line) as IntakeEvent;
          if (e.type === "text") {
            reply += e.text;
            setLive(reply);
          } else if (e.type === "reset") {
            reply = "";
            setLive("");
          } else if (e.type === "error") {
            outcome = "error";
            if (e.kept) setError(e.message);
            else restore(e.message);
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
    <div className="flex flex-col gap-6">
      <ol aria-live="polite" className="flex flex-col gap-4">
        <Bubble message={{ from: "agent", text: greeting }} />
        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {status === "sending" && (
          <Bubble message={{ from: "agent", text: live }} pending={!live} />
        )}
      </ol>
      <div ref={endRef} />

      {status === "finished" ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-foreground/15 p-4">
          <p>That&apos;s everything for now. Next, let&apos;s set a rhythm for the sittings.</p>
          <Link href="/plan/new" className="rounded-md bg-foreground px-4 py-2.5 font-medium text-background">
            See your plan
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
                  <input
                    type="radio"
                    name="speaker"
                    checked={speaker === name}
                    onChange={() => setSpeaker(name)}
                  />
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground/50">Enter to send · Shift+Enter for a new line</span>
            <button
              type="submit"
              disabled={status !== "idle" || !draft.trim()}
              className="rounded-md bg-foreground px-4 py-2.5 font-medium text-background transition-opacity disabled:opacity-50"
            >
              {status === "sending" ? "Waiting…" : "Send"}
            </button>
          </div>
        </form>
      )}
    </div>
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
