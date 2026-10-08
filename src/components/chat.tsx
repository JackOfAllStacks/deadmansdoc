"use client";

import { useEffect, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/transcript";
import { Alert, cx } from "@/components/ui";

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
          "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
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
 * inside itself and the composer stays where you left it.
 *
 * On a phone it takes whatever height is left rather than a measured one: the
 * page above it is a flex column down from the viewport, so the conversation
 * is the only thing that scrolls and the tabs and the box don't move.
 *
 * From sm up the height is measured instead, because the page above it isn't a
 * flex column down from the viewport there. `--chat-inset` is how much of the
 * screen that chrome takes, and a page with a smaller header sets it lower to
 * hand the difference to the conversation -- see the sitting page. The default
 * suits a full page header with a lead paragraph above the frame.
 */
export function ChatFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "flex min-h-0 flex-1 flex-col gap-3 sm:h-[calc(100dvh-var(--chat-inset,18rem))] sm:min-h-[26rem] sm:flex-none sm:gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Transcript({
  greeting,
  messages,
  live,
  pending,
  leading,
}: {
  greeting: string;
  messages: ChatMessage[];
  live?: string;
  pending?: boolean;
  /** Anything that scrolls with the conversation, above the first message. */
  leading?: ReactNode;
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
      {leading}
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

  // One line until there's more than one line in it. An empty box three rows
  // high is three rows of nothing, which on a phone is most of what you can
  // see of the conversation.
  const box = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  return (
    // data-busy is the contract for anything driving the composer from
    // outside -- the in-app demo player, the end-to-end scripts. It used to be
    // whether the button said "Send" or "Waiting…", and there is no button now.
    <form onSubmit={submit} data-busy={busy ? "true" : "false"} className="flex flex-col gap-3">
      {children}
      <textarea
        ref={box}
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        rows={1}
        enterKeyHint="send"
        placeholder="Type your answer…"
        aria-label="Your answer"
        /* text-base, not smaller: under 16px iOS zooms the page on focus. */
        className="max-h-36 resize-none overflow-y-auto rounded-md border border-line-strong bg-surface px-3 py-2 text-base outline-none focus:border-accent"
      />
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">{footer}</div>
        <span aria-live="polite" className="text-sm text-faint">
          {busy ? "Waiting…" : "Enter to send"}
        </span>
      </div>
    </form>
  );
}
