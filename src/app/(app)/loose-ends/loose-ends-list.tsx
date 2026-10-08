"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { answerLooseEnd, routeLooseEnd } from "@/app/(app)/actions";
import { Alert, Badge, Button, Card, cx, SectionHeading } from "@/components/ui";
import type { LooseEnd, LooseEndGroup } from "@/lib/artifact/gaps";

/*
 * One errand per group.
 *
 * The thing a person can actually act on isn't a field, it's a conversation
 * with somebody: three things to ask Peter next time he's round. So the group
 * is the unit on this page and the field is a line inside it, which is the
 * opposite of how the rest of the app is laid out and the right way round
 * here.
 */

const HINTS: Record<string, { placeholder: string; hint: string }> = {
  text: { placeholder: "A sentence or two.", hint: "Written as prose, the way you'd say it." },
  list: { placeholder: "One per line.", hint: "One per line — they print as a list." },
  ordered: { placeholder: "One per line, first thing first.", hint: "One per line, in the order they happen." },
  people: { placeholder: "Names, separated by commas.", hint: "Names only, and only people already in the record." },
};

export function LooseEndGroupPanel({
  group,
  people,
  sittingTitles,
}: {
  group: LooseEndGroup;
  people: string[];
  sittingTitles: Record<string, string>;
}) {
  const count = group.ends.length;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading aside={count === 1 ? "one thing" : `${count} things`}>
        {group.who ? `Ask ${group.who}` : "Nobody named yet"}
      </SectionHeading>

      {!group.who && (
        <p className="measure text-sm text-muted">
          These are the ones with nowhere to go. Putting a name to one is worth as much as answering
          it — a family can ring somebody, and they can&apos;t ring a blank.
        </p>
      )}

      <ul className="grid gap-3 lg:grid-cols-2">
        {group.ends.map((end) => (
          <li key={end.fieldId}>
            <LooseEndCard end={end} people={people} sittingTitle={sittingTitles[end.sittingKey ?? ""] ?? null} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LooseEndCard({
  end,
  people,
  sittingTitle,
}: {
  end: LooseEnd;
  people: string[];
  sittingTitle: string | null;
}) {
  const [mode, setMode] = useState<null | "answer" | "route">(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const nameBox = useRef<HTMLInputElement>(null);

  // An entry with its own details -- an account, a bill -- is more than a box
  // can honestly take, and the sitting that covers it asks the questions that
  // go with it.
  const needsConversation = end.type === "entities";
  const hint = HINTS[end.type] ?? HINTS.text;

  function open(next: "answer" | "route") {
    setError(null);
    setMode(mode === next ? null : next);
  }

  function submit(action: typeof answerLooseEnd, value: string, key: "body" | "who") {
    setError(null);
    start(async () => {
      const form = new FormData();
      form.set("fieldId", end.fieldId);
      form.set(key, value);
      const result = await action({}, form);
      if (result.error) setError(result.error);
      else setMode(null);
    });
  }

  return (
    <Card tone="plain" className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium tracking-wide text-faint uppercase">{end.sectionTitle}</p>
          <h3 className="text-base leading-snug">{end.label}</h3>
        </div>
        {end.priority === "high" && <Badge tone="outstanding">Matters most</Badge>}
      </div>

      {end.note && <p className="text-sm leading-relaxed text-muted">{end.note}</p>}

      {needsConversation ? (
        <p className="mt-auto border-t border-line pt-3 text-sm text-muted">
          This one is a list of entries, so it belongs in a conversation rather than a box.{" "}
          {sittingTitle ? (
            <>
              It&apos;s covered by <span className="text-ink">{sittingTitle}</span> —{" "}
              <Link href="/plan" className="text-accent underline underline-offset-2">
                open the plan
              </Link>
              .
            </>
          ) : (
            <>It comes up in one of the sessions on your plan.</>
          )}
        </p>
      ) : (
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
          {mode === null && (
            <div className="flex flex-wrap gap-2">
              <Button tone="secondary" size="sm" onClick={() => open("answer")}>
                Write the answer
              </Button>
              <Button tone="quiet" size="sm" onClick={() => open("route")}>
                {end.whoWouldKnow ? "Somebody else would know" : "Say who would know"}
              </Button>
            </div>
          )}

          {mode === "answer" && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">The answer</span>
                <textarea
                  ref={box}
                  rows={3}
                  autoFocus
                  placeholder={hint.placeholder}
                  className="rounded-md border border-line-strong bg-surface px-3 py-2 text-base outline-none focus:border-accent"
                />
                <span className="text-sm text-muted">{hint.hint}</span>
              </label>
              {end.type === "people" && people.length > 0 && (
                <p className="text-sm text-muted">In the record so far: {people.join(", ")}.</p>
              )}
              <Actions
                pending={pending}
                label="Save it"
                onSave={() => submit(answerLooseEnd, box.current?.value ?? "", "body")}
                onCancel={() => setMode(null)}
              />
            </div>
          )}

          {mode === "route" && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Who might know?</span>
                <input
                  ref={nameBox}
                  defaultValue={end.whoWouldKnow ?? ""}
                  autoFocus
                  list={`people-${end.fieldId}`}
                  placeholder="A name, or who they are"
                  className="rounded-md border border-line-strong bg-surface px-3 py-2 text-base outline-none focus:border-accent"
                />
                <span className="text-sm text-muted">
                  Anybody — &ldquo;the solicitor&rdquo; is as useful as a name, as long as whoever
                  reads this could work out who you meant.
                </span>
              </label>
              <datalist id={`people-${end.fieldId}`}>
                {people.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <Actions
                pending={pending}
                label="Note that down"
                onSave={() => submit(routeLooseEnd, nameBox.current?.value ?? "", "who")}
                onCancel={() => setMode(null)}
              />
            </div>
          )}

          {error && <Alert>{error}</Alert>}
        </div>
      )}
    </Card>
  );
}

function Actions({
  pending,
  label,
  onSave,
  onCancel,
}: {
  pending: boolean;
  label: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", pending && "opacity-60")}>
      <Button size="sm" onClick={onSave} disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      <Button tone="quiet" size="sm" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
    </div>
  );
}
