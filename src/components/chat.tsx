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

/**
 * Holds a conversation to the height of the screen, so the transcript scrolls
 * inside itself and the composer stays where you left it. Below `sm` it goes
 * back to ordinary page flow: a short scrolling box on a phone is worse than
 * scrolling the page, which is what phones are for.
 */
export function ChatFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-4 sm:h-[calc(100dvh-18rem)] sm:min-h-[26rem]", className)}>
      {children}
    </div>
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
  const boxRef = useRef<HTMLDivElement>(null);

  // Scroll the transcript, never the page. scrollIntoView would walk up to
  // whichever ancestor happens to scroll, which on a short viewport is the
  // document, and the composer would slide out from under the cursor.
  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, live, pending]);

  return (
    <div ref={boxRef} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 sm:pr-3">
      <ol aria-live="polite" aria-label="Conversation" className="flex flex-col gap-4">
        <Bubble message={{ from: "agent", text: greeting }} />
        {messages.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {pending && <Bubble message={{ from: "agent", text: live ?? "" }} pending={!live} />}
      </ol>
    </div>
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
  /** Anything that belongs above the box. */
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
