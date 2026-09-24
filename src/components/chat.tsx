"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/transcript";
import { Alert, Button, cx } from "@/components/ui";

/*
 * The conversation itself, shared by the opening conversation and the sittings.
 * Both had their own copy of all of this; they now differ only in what sits
 * around them.
 */

export function Bubble({ message, pending = false }: { message: ChatMessage; pending?: boolean }) {
  const isAgent = message.from === "agent";
  return (
    <li className={cx("flex flex-col gap-1", isAgent ? "items-start" : "items-end")}>
      {!isAgent && message.name && <span className="text-xs text-faint">{message.name}</span>}
      <div
        className={cx(
          "max-w-[85%] rounded-lg px-4 py-3 leading-relaxed whitespace-pre-wrap",
          isAgent ? "border border-line bg-surface" : "bg-accent text-accent-ink",
        )}
      >
        {pending ? (
          <span className="text-muted" aria-label="Thinking">
            …
          </span>
        ) : (
          message.text
        )}
      </div>
    </li>
  );
}

export function Transcript({
  greeting,
  messages,
  live,
  pending,
}: {
  greeting: string;
  messages: ChatMessage[];
  live?: string;
  pending?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, live, pending]);

  return (
    <>
      <ol aria-live="polite" aria-label="Conversation" className="flex flex-col gap-4">
        <Bubble message={{ from: "agent", text: greeting }} />
        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {pending && <Bubble message={{ from: "agent", text: live ?? "" }} pending={!live} />}
      </ol>
      <div ref={endRef} />
    </>
  );
}

export function SpeakerPicker({
  speakers,
  speaker,
  onChange,
}: {
  speakers: string[];
  speaker: string;
  onChange: (name: string) => void;
}) {
  if (speakers.length < 2) return null;
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <legend className="sr-only">Who is typing?</legend>
      <span className="text-muted">Who&apos;s typing:</span>
      {speakers.map((name) => (
        <label key={name} className="flex items-center gap-1.5">
          <input type="radio" name="speaker" checked={speaker === name} onChange={() => onChange(name)} />
          {name}
        </label>
      ))}
    </fieldset>
  );
}

export function Composer({
  draft,
  onDraft,
  onSend,
  maxLength,
  busy,
  error,
  children,
  footer,
}: {
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  maxLength: number;
  busy: boolean;
  error: string | null;
  /** The speaker picker, or anything else that belongs above the box. */
  children?: ReactNode;
  /** Anything that belongs beside the send button — a way out, usually. */
  footer?: ReactNode;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSend();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {children}
      <textarea
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        rows={3}
        placeholder="Type your answer…"
        aria-label="Your answer"
        className="resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-base outline-none focus:border-accent"
      />
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">{footer}</div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-faint sm:inline">Enter to send</span>
          <Button type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Waiting…" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
