"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reopenConversation } from "@/app/(app)/actions";
import { Composer, SpeakerPicker, Transcript } from "@/components/chat";
import { Alert, Button, ButtonLink, Card, Note, SectionHeading } from "@/components/ui";
import type { IntakeEvent } from "@/lib/intake/agent";
import type { ChatMessage } from "@/lib/transcript";

type Status = "idle" | "sending" | "finished";

export interface Area {
  title: string;
  summary: string;
}

export function IntakeChat({
  greeting,
  history,
  speakers,
  maxLength,
  areas,
  finished,
  hasPlan,
}: {
  greeting: string;
  history: ChatMessage[];
  speakers: string[];
  maxLength: number;
  areas: Area[];
  finished: boolean;
  hasPlan: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(history);
  const [live, setLive] = useState("");
  const [draft, setDraft] = useState("");
  const [speaker, setSpeaker] = useState(speakers[0]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [revised, setRevised] = useState(0);
  // Nobody is dropped straight into an empty box: a fresh conversation opens
  // on an explanation of what it's for and what it leads to.
  const [started, setStarted] = useState(history.length > 0);

  async function send() {
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
          } else if (e.type === "done") {
            outcome = "done";
            setRevised(e.revised);
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

  if (finished) return <Finished greeting={greeting} messages={messages} hasPlan={hasPlan} />;
  if (!started) return <BeforeYouBegin areas={areas} onBegin={() => setStarted(true)} />;

  if (status === "finished") {
    return (
      <div className="flex flex-col gap-6">
        <Transcript greeting={greeting} messages={messages} />
        <Card tone="accent" className="flex flex-col items-start gap-3">
          {hasPlan ? (
            <>
              <h2 className="text-lg">Thank you — that&apos;s been taken into account</h2>
              <p className="measure text-sm text-muted">
                {revised > 0
                  ? `The ${revised === 1 ? "sitting" : `${revised} sittings`} you haven't started yet have been re-worked around what you've just added. Anything already done stays exactly as it was.`
                  : "Everything in your plan has already been started or finished, so nothing has been changed."}
              </p>
              <ButtonLink href="/plan">Back to your plan</ButtonLink>
            </>
          ) : (
            <>
              <h2 className="text-lg">That&apos;s everything for now</h2>
              <p className="measure text-sm text-muted">
                Next comes the plan: a handful of short sittings, and when you&apos;d like to do them.
              </p>
              <ButtonLink href="/plan/new">See your plan</ButtonLink>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Note>
        Rough answers are what&apos;s wanted here — a number, a yes or a no. &ldquo;Not sure&rdquo; is
        a real answer, and the detail comes later, a bit at a time.
      </Note>
      <Transcript greeting={greeting} messages={messages} live={live} pending={status === "sending"} />
      <Composer
        draft={draft}
        onDraft={setDraft}
        onSend={send}
        maxLength={maxLength}
        busy={status !== "idle"}
        error={error}
        footer={<span>Stopping here keeps everything said so far.</span>}
      >
        <SpeakerPicker speakers={speakers} speaker={speaker} onChange={setSpeaker} />
      </Composer>
    </div>
  );
}

/** Context before the empty box: what this is, and what it leads to. */
function BeforeYouBegin({ areas, onBegin }: { areas: Area[]; onBegin: () => void }) {
  const steps: [string, string][] = [
    [
      "A short conversation, about five minutes",
      "Rough answers only — how many people, roughly what's involved. No numbers, no account details, nothing to go and look up.",
    ],
    [
      "It works out a plan",
      "A handful of short sittings, each covering one part of the record, in whatever order suits what you've said.",
    ],
    [
      "Then you do them whenever you like",
      "Half an hour at most, and you can stop part-way through any of them.",
    ],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card tone="raised" className="flex flex-col gap-4">
        <h2 className="text-xl">What happens now</h2>
        <ol className="flex flex-col gap-3">
          {steps.map(([title, detail], i) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm tabular-nums text-accent">
                {i + 1}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{title}</span>
                <span className="text-sm text-muted">{detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <section className="flex flex-col gap-3">
        <SectionHeading aside="in the sittings after this">What the record covers</SectionHeading>
        <ul className="grid gap-3 sm:grid-cols-2">
          {areas.map((area) => (
            <li key={area.title} className="rounded-md border border-line bg-surface p-4">
              <p className="font-medium">{area.title}</p>
              <p className="mt-1 text-sm text-muted">{area.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <Note>
        None of this is a legal document, and nothing here is shown to anyone else. You can stop at
        any point — what&apos;s been said is kept.
      </Note>

      <Button onClick={onBegin} className="self-start">
        Start the conversation
      </Button>
    </div>
  );
}

/** Once it's over it stays readable — and can be added to. */
function Finished({
  greeting,
  messages,
  hasPlan,
}: {
  greeting: string;
  messages: ChatMessage[];
  hasPlan: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reopen() {
    setPending(true);
    setError(null);
    const result = await reopenConversation();
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Note>
        This conversation is finished. It&apos;s kept here because it&apos;s the reason the plan came
        out the way it did.
      </Note>
      <Transcript greeting={greeting} messages={messages} />
      <Card tone="quiet" className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">Thought of something since?</h2>
          <p className="measure text-sm text-muted">
            {hasPlan
              ? "You can add to this. The sittings you haven't started yet get re-worked around whatever you add; anything already done stays as it is."
              : "You can add to this before the plan is set."}
          </p>
        </div>
        {error && <Alert>{error}</Alert>}
        <Button tone="secondary" onClick={reopen} disabled={pending}>
          {pending ? "Opening…" : "Add something to this"}
        </Button>
      </Card>
    </div>
  );
}
