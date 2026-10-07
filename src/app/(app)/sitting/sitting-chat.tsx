"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Composer, SpeakerPicker, Transcript } from "@/components/chat";
import { TopicChecklist } from "@/components/topics";
import { Badge, ButtonLink, Card, Note, Progress as ProgressBar } from "@/components/ui";
import type { SittingEvent } from "@/lib/sitting/agent";
import type { CapturedItem } from "@/lib/sitting/capture";
import type { Coverage, TopicProgress } from "@/lib/sitting/coverage";
import type { ChatMessage } from "@/lib/transcript";

type Status = "idle" | "sending" | "finished" | "catching-up";
type Progress = Pick<Coverage, "answered" | "gaps" | "total">;

const KIND: Record<CapturedItem["kind"], { label: string; tone: "recorded" | "unknown" | "neutral" | "accent" }> = {
  field: { label: "Recorded", tone: "recorded" },
  entity: { label: "Added", tone: "recorded" },
  amount: { label: "Sealed", tone: "accent" },
  gap: { label: "Not known", tone: "unknown" },
  note: { label: "Noted", tone: "neutral" },
};

export function SittingChat({
  greeting,
  history,
  captured,
  coverage,
  topics,
  speakers,
  maxLength,
  busy,
}: {
  greeting: string;
  history: ChatMessage[];
  captured: CapturedItem[];
  coverage: Coverage;
  topics: TopicProgress[];
  speakers: string[];
  maxLength: number;
  busy: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(history);
  const [items, setItems] = useState<CapturedItem[]>(captured);
  const [progress, setProgress] = useState<Progress>(coverage);
  const [areas, setAreas] = useState<TopicProgress[]>(topics);
  const [live, setLive] = useState("");
  const [draft, setDraft] = useState("");
  const [speaker, setSpeaker] = useState(speakers[0]);
  const [status, setStatus] = useState<Status>(busy ? "catching-up" : "idle");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
            setAreas(e.topics);
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

  const waiting = status === "sending" || status === "catching-up";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      {/* On a phone the areas come first: they're what stops the box being a
          blank one. The conversation scrolls itself into view after every turn,
          so being second costs nothing once it's under way. */}
      <div className="order-2 flex flex-col gap-6 lg:order-1">
        <Transcript greeting={greeting} messages={messages} live={live} pending={waiting} />

        {status === "finished" ? (
          <Card tone="accent" className="flex flex-col items-start gap-3">
            <h2 className="text-lg">That&apos;s this sitting done</h2>
            {summary && <p className="measure text-sm text-muted">{summary}</p>}
            <ButtonLink href="/plan">Back to your plan</ButtonLink>
          </Card>
        ) : (
          <Composer
            draft={draft}
            onDraft={setDraft}
            onSend={send}
            maxLength={maxLength}
            busy={status !== "idle"}
            error={error}
            footer={
              <ButtonLink href="/plan" tone="quiet">
                Stop for now
              </ButtonLink>
            }
          >
            <SpeakerPicker speakers={speakers} speaker={speaker} onChange={setSpeaker} />
          </Composer>
        )}
      </div>

      <aside className="order-1 flex h-fit flex-col gap-4 lg:order-2 lg:sticky lg:top-6">
        <TopicChecklist topics={areas} />
        <CapturePanel items={items} progress={progress} />
      </aside>
    </div>
  );
}

function CapturePanel({ items, progress }: { items: CapturedItem[]; progress: Progress }) {
  const done = progress.answered + progress.gaps;
  return (
    <Card tone="plain" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <h2 className="text-base">What we&apos;ve written down</h2>
        <p className="text-sm text-muted">
          {progress.answered} recorded
          {progress.gaps > 0 && `, ${progress.gaps} to find out`} of {progress.total}
        </p>
        <ProgressBar value={done} max={progress.total} label="Recorded so far" tone="recorded" />
      </div>

      {items.length ? (
        <ol className="flex flex-col gap-2 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex flex-col items-start gap-1 border-t border-line pt-2">
              <Badge tone={KIND[item.kind].tone}>{KIND[item.kind].label}</Badge>
              <span className="leading-snug">{item.label}</span>
              {item.detail && <span className="text-muted">{item.detail}</span>}
            </li>
          ))}
        </ol>
      ) : (
        <Note>Things appear here as you talk. Nothing is written down until you say it.</Note>
      )}
    </Card>
  );
}
