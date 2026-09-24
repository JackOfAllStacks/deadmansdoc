"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Coverage } from "@/lib/sitting/coverage";
import type { DocumentEntry, DocumentFieldView, DocumentSectionView } from "@/lib/sitting/document";
import type { SittingEvent } from "@/lib/sitting/agent";
import type { ChatMessage } from "@/lib/transcript";

type Status = "idle" | "sending" | "finished" | "catching-up";
type Progress = Pick<Coverage, "answered" | "gaps" | "total">;

// What an edit -- or a tool call, live during the conversation -- hands back:
// enough to place one entry in the document and refresh the progress bar,
// without a round trip back through the server for the rest of the outline.
interface EditResult {
  kind: DocumentEntry["kind"];
  fieldId: string | null;
  entityId: string | null;
  label: string;
  text: string | null;
  detail: string | null;
  attributes: Record<string, string> | null;
  progress: Progress;
}

// A field already holding an entry for this same entity (or, for a plain
// field, its one entry) gets updated in place; anything else is new. Shared
// by the live SSE stream and by a direct edit, so a hand correction and
// something the model just recorded land in the document the same way.
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

async function submitEdit(body: Record<string, unknown>): Promise<{ ok: true; data: EditResult } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/sitting/edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error ?? "Something went wrong. Please try again." };
    return { ok: true, data: json as EditResult };
  } catch {
    return { ok: false, error: "The connection dropped. Please try again." };
  }
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

  // A hand edit and a tool call both end up here, so the panel doesn't care
  // which one it was.
  function applyEntry(entry: Omit<EditResult, "progress">) {
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

  // An edit's response carries its own progress recount; a live tool call's
  // "saved" event doesn't -- the turn's separate "progress" event is the one
  // to trust there, so it isn't duplicated with a stale snapshot here.
  function applyResult(result: EditResult) {
    applyEntry(result);
    setProgress(result.progress);
  }

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

      <DocumentPanel outline={doc} notes={extraNotes} progress={progress} onSaved={applyResult} />
    </div>
  );
}

// The document itself, unfolding as the conversation fills it in -- and
// editable in place: every field this sitting can fill is shown from the
// start, empty, under the same headers the finished Guide will use, and
// whatever lands there, spoken or typed, can be corrected the same way.
function DocumentPanel({
  outline,
  notes,
  progress,
  onSaved,
}: {
  outline: DocumentSectionView[];
  notes: DocumentEntry[];
  progress: Progress;
  onSaved: (result: EditResult) => void;
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
                <dl className="flex flex-col gap-3">
                  {group.fields.map((field) => (
                    <FieldBlock key={field.id} field={field} onSaved={onSaved} />
                  ))}
                </dl>
              </div>
            ))}
          </section>
        ))}

        {notes.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Other notes</h3>
            <ul className="flex flex-col gap-2">
              {notes.map((note, i) => (
                <NoteBlock key={i} note={note} onSaved={onSaved} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}

const editButton = "shrink-0 text-xs text-foreground/50 underline hover:text-foreground/80";
const saveButton =
  "rounded bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-opacity disabled:opacity-50";
const textInput =
  "rounded border border-foreground/20 bg-background px-2 py-1 text-sm outline-none focus:border-foreground/60";

function FieldBlock({ field, onSaved }: { field: DocumentFieldView; onSaved: (result: EditResult) => void }) {
  if (field.type === "entities") return <EntitiesField field={field} onSaved={onSaved} />;
  return <PlainField field={field} onSaved={onSaved} />;
}

// A field with one value: prose, a list, an ordered sequence, or names it
// points at. Never covered, noted as a gap, or answered -- the same editor
// handles all three, since answering it is how a gap gets resolved.
function PlainField({ field, onSaved }: { field: DocumentFieldView; onSaved: (result: EditResult) => void }) {
  const entry = field.entries[0];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setValue(entry?.kind === "field" ? (entry.text ?? "") : "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    const text = value.trim();
    if (!text) {
      setError("Type something first, or Cancel.");
      return;
    }
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      kind: "field",
      field_id: field.id,
      text: null,
      items: null,
      people: null,
      family_action: entry?.detail ?? null,
      confidence: "stated",
      disclosure: null,
    };
    if (field.type === "text") {
      body.text = text;
    } else {
      const parts = text
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (field.type === "people") body.people = parts;
      else body.items = parts;
    }
    const result = await submitEdit(body);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data);
    setEditing(false);
  }

  return (
    <div data-field={field.id} className="flex flex-col gap-1 border-t border-foreground/10 pt-2">
      <div className="flex items-start justify-between gap-2">
        <dt className="text-foreground/70">{field.label}</dt>
        {!editing && (
          <button type="button" onClick={start} className={editButton}>
            {entry?.kind === "field" ? "Edit" : "Answer"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-1.5">
          {entry?.kind === "gap" && (
            <p className="text-xs text-foreground/50">
              Currently noted as unknown{entry.detail ? ` — ${entry.detail} might know` : ""}.
            </p>
          )}
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={field.type === "text" ? 3 : 2}
            placeholder={
              field.type === "people"
                ? "Names, separated by commas"
                : field.type === "list" || field.type === "ordered"
                  ? "One per line, or separated by commas"
                  : undefined
            }
            className={`resize-y ${textInput}`}
          />
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className={saveButton}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className={editButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : entry?.kind === "field" ? (
        <dd className="whitespace-pre-wrap text-foreground/90">{entry.text}</dd>
      ) : entry?.kind === "gap" ? (
        <dd className="text-foreground/40">Not yet known{entry.detail ? ` — ask ${entry.detail}` : ""}</dd>
      ) : (
        <dd className="text-foreground/40">Not yet covered</dd>
      )}
    </div>
  );
}

// A repeated record: people, accounts, bills, debts, income. Each entry edits
// on its own, and a new one can be added the same way -- except a sealed
// figure, which only ever corrects something already there.
function EntitiesField({ field, onSaved }: { field: DocumentFieldView; onSaved: (result: EditResult) => void }) {
  const [adding, setAdding] = useState(false);
  const real = field.entries.filter((e) => e.entityId);
  const gap = field.entries.find((e) => !e.entityId);

  return (
    <div data-field={field.id} className="flex flex-col gap-2 border-t border-foreground/10 pt-2">
      <dt className="text-foreground/70">{field.label}</dt>
      {gap && (
        <p className="text-xs text-foreground/40">Also noted as unknown{gap.detail ? ` — ask ${gap.detail}` : ""}.</p>
      )}
      {real.length === 0 && !gap && !adding && <dd className="text-foreground/40">Not yet covered</dd>}
      {(real.length > 0 || adding) && (
        <dd className="flex flex-col gap-2">
          {real.map((entry) => (
            <EntityEntry key={entry.entityId} field={field} entry={entry} onSaved={onSaved} />
          ))}
          {adding && (
            <EntityEntry
              field={field}
              entry={null}
              onSaved={(result) => {
                onSaved(result);
                setAdding(false);
              }}
              onCancelNew={() => setAdding(false)}
            />
          )}
        </dd>
      )}
      {!field.sealed && !adding && (
        <button type="button" onClick={() => setAdding(true)} className={`self-start ${editButton}`}>
          + Add
        </button>
      )}
    </div>
  );
}

function EntityEntry({
  field,
  entry,
  onSaved,
  onCancelNew,
}: {
  field: DocumentFieldView;
  entry: DocumentEntry | null;
  onSaved: (result: EditResult) => void;
  onCancelNew?: () => void;
}) {
  const isNew = entry === null;
  const [editing, setEditing] = useState(isNew);
  const [name, setName] = useState(entry?.label ?? "");
  const [attrs, setAttrs] = useState<Record<string, string>>(entry?.attributes ?? {});
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (field.sealed) {
      if (!amount.trim()) {
        setError("Type a figure first, or Cancel.");
        return;
      }
      setSaving(true);
      const result = await submitEdit({
        kind: "amount",
        field_id: field.id,
        entity_label: entry!.label,
        amount: amount.trim(),
        confidence: "stated",
      });
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(result.data);
      setEditing(false);
      return;
    }

    if (!name.trim()) {
      setError("This needs a name.");
      return;
    }
    setSaving(true);
    const result = await submitEdit({
      kind: "entity",
      field_id: field.id,
      entity_id: entry?.entityId ?? null,
      label: name.trim(),
      attributes: field.attributeKeys
        .filter((key) => key !== "name" && attrs[key]?.trim())
        .map((key) => ({ key, value: attrs[key].trim() })),
      family_action: entry?.detail ?? null,
      confidence: "stated",
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data);
    setEditing(false);
  }

  function cancel() {
    if (isNew) {
      onCancelNew?.();
      return;
    }
    setName(entry.label);
    setAttrs(entry.attributes ?? {});
    setError(null);
    setEditing(false);
  }

  if (!editing && entry) {
    return (
      <div data-entry={entry.entityId ?? ""} className="flex items-start justify-between gap-2">
        <span>
          <span className="font-medium">{entry.label}</span>
          {field.sealed ? " — Sealed" : entry.text ? ` — ${entry.text}` : ""}
        </span>
        <button type="button" onClick={() => setEditing(true)} className={editButton}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <div data-editing={entry?.entityId ?? "new"} className="flex flex-col gap-1.5 rounded-md border border-foreground/15 p-2">
      {field.sealed ? (
        <input
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Figure for ${entry?.label ?? ""}`}
          className={textInput}
        />
      ) : (
        <>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className={`font-medium ${textInput}`}
          />
          {field.attributeKeys
            .filter((key) => key !== "name")
            .map((key) => (
              <input
                key={key}
                value={attrs[key] ?? ""}
                onChange={(e) => setAttrs((a) => ({ ...a, [key]: e.target.value }))}
                placeholder={key.replace(/_/g, " ")}
                className={textInput}
              />
            ))}
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving} className={saveButton}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={cancel} disabled={saving} className={editButton}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function NoteBlock({ note, onSaved }: { note: DocumentEntry; onSaved: (result: EditResult) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const text = value.trim();
    if (!text) {
      setError("A note needs some text.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await submitEdit({
      kind: "note",
      label: note.label,
      value: text,
      family_action: note.detail,
      confidence: "stated",
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data);
    setEditing(false);
  }

  return (
    <li className="flex flex-col gap-1 border-t border-foreground/10 pt-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{note.label}</span>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setValue(note.text ?? "");
              setError(null);
              setEditing(true);
            }}
            className={editButton}
          >
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <textarea autoFocus value={value} onChange={(e) => setValue(e.target.value)} rows={2} className={`resize-y ${textInput}`} />
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className={saveButton}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className={editButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        note.text && <span>{note.text}</span>
      )}
    </li>
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
