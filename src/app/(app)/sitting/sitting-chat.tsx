"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Composer, SpeakerPicker, Transcript } from "@/components/chat";
import { TopicStrip } from "@/components/topics";
import { Alert, ButtonLink, Card, Progress as ProgressBar } from "@/components/ui";
import { renderBlock, type BlockShape } from "@/lib/sitting/block";
import type { SittingEvent } from "@/lib/sitting/agent";
import type { Coverage, TopicProgress } from "@/lib/sitting/coverage";
import type { DocumentEntry, DocumentFieldView, DocumentSectionView } from "@/lib/sitting/document";
import type { ChatMessage } from "@/lib/transcript";

type Status = "idle" | "sending" | "finished" | "catching-up";
type Progress = Pick<Coverage, "answered" | "gaps" | "total">;

/** What the whole document looks like after an edit, read back from the database. */
interface Snapshot {
  outline: DocumentSectionView[];
  notes: DocumentEntry[];
  progress: Progress;
  people: string[];
}

type SaveBlock = (payload: Record<string, string>) => Promise<string | null>;

// A field already holding an entry for this same entity (or, for a plain
// field, its one entry) gets updated in place; anything else is new. This is
// the live path only -- an edit gets the whole document back instead.
function place(outline: DocumentSectionView[], fieldId: string, entry: DocumentEntry): DocumentSectionView[] {
  return outline.map((section) => ({
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      fields: group.fields.map((field) => {
        if (field.id !== fieldId) return field;
        const at = entry.entityId
          ? field.entries.findIndex((e) => e.entityId === entry.entityId)
          : field.entries.findIndex((e) => e.entityId === null);
        const entries = at === -1 ? [...field.entries, entry] : field.entries.map((e, i) => (i === at ? entry : e));
        return { ...field, entries };
      }),
    })),
  }));
}

function placeNote(notes: DocumentEntry[], entry: DocumentEntry): DocumentEntry[] {
  const at = notes.findIndex((n) => n.label === entry.label);
  return at === -1 ? [...notes, entry] : notes.map((n, i) => (i === at ? entry : n));
}

const shapeOf = (field: DocumentFieldView): BlockShape => ({
  type: field.type,
  attributeKeys: field.attributeKeys,
  sealed: field.sealed,
});

export function SittingChat({
  greeting,
  history,
  outline,
  notes,
  people,
  coverage,
  topics,
  speakers,
  maxLength,
  busy,
}: {
  greeting: string;
  history: ChatMessage[];
  outline: DocumentSectionView[];
  notes: DocumentEntry[];
  people: string[];
  coverage: Coverage;
  topics: TopicProgress[];
  speakers: string[];
  maxLength: number;
  busy: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(history);
  const [doc, setDoc] = useState<DocumentSectionView[]>(outline);
  const [extraNotes, setExtraNotes] = useState<DocumentEntry[]>(notes);
  const [known, setKnown] = useState<string[]>(people);
  const [progress, setProgress] = useState<Progress>(coverage);
  const [areas, setAreas] = useState<TopicProgress[]>(topics);
  const [live, setLive] = useState("");
  const [draft, setDraft] = useState("");
  const [speaker, setSpeaker] = useState(speakers[0]);
  const [status, setStatus] = useState<Status>(busy ? "catching-up" : "idle");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // An edit sends one field's body and gets the whole document back, read out
  // of the database rather than assembled from what was just sent -- so what
  // stays on screen is what was really stored. Returns an error to show in
  // place, or null.
  const saveBlock: SaveBlock = async (payload) => {
    try {
      const res = await fetch("/api/sitting/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return json.error ?? "That couldn't be saved. Please try again.";
      const snapshot = json as Snapshot;
      setDoc(snapshot.outline);
      setExtraNotes(snapshot.notes);
      setProgress(snapshot.progress);
      setKnown(snapshot.people);
      return null;
    } catch {
      return "The connection dropped. Please try again.";
    }
  };

  function applyEntry(entry: Omit<DocumentEntry, "kind"> & { kind: DocumentEntry["kind"]; fieldId: string | null }) {
    if (entry.kind === "note") {
      setExtraNotes((current) =>
        placeNote(current, {
          kind: "note",
          entityId: null,
          label: entry.label,
          text: entry.text,
          detail: entry.detail,
          attributes: null,
        }),
      );
    } else if (entry.fieldId) {
      const fieldId = entry.fieldId;
      setDoc((current) =>
        place(current, fieldId, {
          kind: entry.kind,
          entityId: entry.entityId,
          label: entry.label,
          text: entry.text,
          detail: entry.detail,
          attributes: entry.attributes,
        }),
      );
    }
  }

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
            applyEntry({
              kind: e.kind,
              fieldId: e.fieldId,
              entityId: e.entityId,
              label: e.label,
              text: e.text,
              detail: e.detail,
              attributes: e.attributes,
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,34rem)]">
      {/* On a phone the document comes first: seeing something being written
          is what makes the box worth typing into. The conversation scrolls
          itself into view after every turn, so it costs nothing once under way. */}
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

      <DocumentPanel
        outline={doc}
        notes={extraNotes}
        people={known}
        progress={progress}
        topics={areas}
        locked={waiting}
        save={saveBlock}
      />
    </div>
  );
}

// The document itself, unfolding as the conversation fills it in. The
// headings are the skeleton and stay put; everything under them is the
// document's text, and clicking any of it puts a cursor in it. What's shown
// and what's edited are the same characters, so nothing reflows under the
// cursor and nothing is lost putting it back.
function DocumentPanel({
  outline,
  notes,
  people,
  progress,
  topics,
  locked,
  save,
}: {
  outline: DocumentSectionView[];
  notes: DocumentEntry[];
  people: string[];
  progress: Progress;
  topics: TopicProgress[];
  locked: boolean;
  save: SaveBlock;
}) {
  const done = progress.answered + progress.gaps;
  return (
    <aside className="order-1 flex h-fit max-h-[calc(100vh-3rem)] flex-col gap-5 overflow-y-auto rounded-lg border border-line bg-surface px-6 py-6 sm:px-7 lg:sticky lg:top-6 lg:order-2">
      <div className="flex flex-col gap-3 border-b border-line pb-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg">The document, so far</h2>
          <p className="text-xs text-muted">
            {progress.answered} recorded
            {progress.gaps > 0 && `, ${progress.gaps} to find out`} of {progress.total} ·{" "}
            {locked ? "being written…" : "type anywhere to change it"}
          </p>
          <ProgressBar value={done} max={progress.total} label="Recorded so far" tone="recorded" />
        </div>
        <TopicStrip topics={topics} />
      </div>

      <article className="flex flex-col gap-8 text-[0.9375rem] leading-relaxed">
        {outline.map((section) => (
          <section key={section.id} className="flex flex-col gap-5">
            <h3 className="border-b border-line pb-1.5 font-sans text-[0.6875rem] font-bold tracking-[0.14em] text-faint uppercase">
              {section.title}
            </h3>
            {section.groups.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-5">
                {group.title && <h4 className="text-sm font-semibold text-ink">{group.title}</h4>}
                {group.fields.map((field) => (
                  <FieldBody key={field.id} field={field} people={people} locked={locked} save={save} />
                ))}
              </div>
            ))}
          </section>
        ))}

        {notes.length > 0 && (
          <section className="flex flex-col gap-5">
            <h3 className="border-b border-line pb-1.5 font-sans text-[0.6875rem] font-bold tracking-[0.14em] text-faint uppercase">
              Also worth knowing
            </h3>
            {notes.map((note) => (
              <NoteBody key={note.label} note={note} locked={locked} save={save} />
            ))}
          </section>
        )}
      </article>
    </aside>
  );
}

const isAction = (line: string) => /^what to do\s*:/i.test(line.trim());

// The document's text is always editable, so it is built as real DOM rather
// than rendered by React: React never owns anything inside it, which is what
// stops a re-render landing mid-sentence and taking the cursor with it.
//
// Bullets and numbering are list markers, not characters, so reading the text
// back gives exactly the lines that went in -- nothing to strip, nothing to
// mistake for something somebody typed.

function span(text: string, className?: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

/** Sets keys back a shade, so the eye can read past them to the answer. */
function detailInto(parent: HTMLElement, text: string) {
  for (const part of text.split(/(\b[a-z][a-z ]*:)/i)) {
    if (!part) continue;
    parent.append(span(part, /^[a-z][a-z ]*:$/i.test(part) ? "text-faint" : undefined));
  }
}

function lineInto(parent: HTMLElement, field: DocumentFieldView, line: string) {
  const split = line.indexOf("—");
  if (split === -1 || field.type !== "entities") {
    parent.append(span(line));
    return;
  }
  parent.append(span(line.slice(0, split).trim(), "font-medium"));
  parent.append(span(" — ", "text-faint"));
  detailInto(parent, line.slice(split + 1).trim());
}

function paint(host: HTMLElement, field: DocumentFieldView, body: string) {
  host.replaceChildren();
  const all = body.split("\n").filter((l) => l.trim());
  const lines = field.type === "entities" ? all : all.filter((l) => !isAction(l));
  const action = field.type === "entities" ? undefined : all.find(isAction);

  if (field.type === "text") {
    const p = document.createElement("div");
    p.className = "whitespace-pre-wrap";
    p.textContent = lines.join("\n");
    host.append(p);
  } else if (lines.length) {
    const list = document.createElement(field.type === "ordered" ? "ol" : "ul");
    list.className =
      field.type === "ordered"
        ? "list-decimal list-outside pl-5 marker:text-faint"
        : "list-disc list-outside pl-5 marker:text-faint";
    for (const line of lines) {
      const li = document.createElement("li");
      lineInto(li, field, line);
      list.append(li);
    }
    host.append(list);
  }

  if (action) {
    const el = document.createElement("div");
    el.className = "mt-1 text-muted";
    el.append(span("what to do:", "text-faint"));
    el.append(span(action.slice(action.indexOf(":") + 1)));
    host.append(el);
  }
}

/** The visible text, which is what the body was built from in the first place. */
const readBack = (host: HTMLElement) => host.innerText.replace(/ /g, " ").trimEnd();

function LiveBody({
  field,
  body,
  label,
  locked,
  onCommit,
  onFocusChange,
}: {
  field: DocumentFieldView;
  body: string;
  label: string;
  locked: boolean;
  onCommit: (text: string) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Repaint from what was stored, but never over the top of someone typing.
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    paint(el, field, body);
  }, [field, body]);

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      contentEditable={!locked}
      suppressContentEditableWarning
      spellCheck
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => {
        onFocusChange?.(false);
        const el = ref.current;
        if (el) onCommit(readBack(el));
      }}
      onPaste={(e) => {
        // Whatever was copied, what lands is text: this is a document of
        // plain sentences, not a place for someone else's formatting.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        e.currentTarget.ownerDocument.execCommand("insertText", false, text);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          const el = ref.current;
          if (el) {
            paint(el, field, body);
            el.blur();
          }
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          ref.current?.blur();
        }
        // Select-all belongs to the part being written in. Left to the
        // browser it can reach past it, and the next keystroke would take
        // the rest of the document with it.
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
          const el = ref.current;
          if (!el) return;
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(el);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }}
      // Empty is left empty -- room waiting to be written in, rather than a
      // line of filler saying there is nothing there. The height keeps it
      // big enough to put a cursor in.
      className={`-mx-1 min-h-[1.75rem] rounded-sm px-1 py-0.5 text-ink outline-none ${
        locked ? "cursor-default opacity-70" : "cursor-text hover:bg-soft focus:bg-soft focus:ring-1 focus:ring-accent/40"
      }`}
    />
  );
}

function FieldBody({
  field,
  people,
  locked,
  save,
}: {
  field: DocumentFieldView;
  people: string[];
  locked: boolean;
  save: SaveBlock;
}) {
  const body = renderBlock(shapeOf(field), field.entries);
  const gap = field.entries.find((e) => e.kind === "gap");
  const [saving, setSaving] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit(text: string) {
    if (text === body) {
      setError(null);
      return;
    }
    setSaving(true);
    const message = await save({ field_id: field.id, body: text });
    setSaving(false);
    // A refusal leaves what they wrote where it is, and says why: the point of
    // saying so is that it can be put right.
    setError(message);
  }

  return (
    <div data-field={field.id} className="flex flex-col gap-1.5">
      <h5 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted uppercase">{field.label}</h5>

      {!body && gap ? (
        <p className="text-faint italic">Not yet known{gap.detail ? ` — ${gap.detail} may know` : ""}.</p>
      ) : null}

      <LiveBody
        field={field}
        body={body}
        label={field.label}
        locked={locked}
        onCommit={commit}
        onFocusChange={setWriting}
      />

      {field.type === "people" && people.length > 0 && writing && (
        <p className="text-xs text-faint">Names, separated by commas: {people.join(", ")}</p>
      )}
      {saving && <p className="text-xs text-faint">Saving…</p>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

function NoteBody({ note, locked, save }: { note: DocumentEntry; locked: boolean; save: SaveBlock }) {
  const body = note.text ?? "";
  const [error, setError] = useState<string | null>(null);
  const asField: DocumentFieldView = {
    id: `note:${note.label}`,
    label: note.label,
    type: "text",
    entityType: null,
    attributeKeys: [],
    sealed: false,
    entries: [],
  };

  async function commit(text: string) {
    if (text === body) return;
    setError(await save({ note_label: note.label, body: text }));
  }

  return (
    <div className="flex flex-col gap-1">
      <h5 className="font-sans text-xs font-semibold tracking-[0.06em] text-muted uppercase">{note.label}</h5>
      <LiveBody field={asField} body={body} label={note.label} locked={locked} onCommit={commit} />
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
