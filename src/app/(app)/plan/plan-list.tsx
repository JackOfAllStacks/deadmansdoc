"use client";

import { useState, useTransition } from "react";
import { reorderPlan } from "@/app/(app)/actions";
import { TopicChips } from "@/components/topics";
import { areaOf, Alert, Badge, ButtonLink, Card, cx } from "@/components/ui";
import { formatMinutes } from "@/lib/plan/build-plan";
import { StartSitting } from "./start-sitting";

export interface PlanItem {
  id: string;
  seq: number;
  title: string;
  sittingKey: string;
  status: "planned" | "in_progress" | "done" | "skipped";
  minutes: number;
  summary: string;
  topics: { label: string; blurb: string; covers: string[] }[];
}

/*
 * Rearranging the plan.
 *
 * Dragging is the obvious way to do this and the wrong way to do it on its
 * own: the person this product is built for may be in their eighties, on a
 * touch screen, with a hand that isn't steady. So the buttons are the real
 * mechanism — they work from the keyboard, they work under a thumb, and they
 * say what they do — and dragging is an extra for whoever reaches for it.
 *
 * Only sittings nobody has started can move. The slots stay put and the
 * sittings move between them, so the started ones keep their places.
 */
export function PlanList({ items }: { items: PlanItem[] }) {
  const [list, setList] = useState(items);
  const [fromServer, setFromServer] = useState(items);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  // The server is the truth and this list is an optimistic view of it, so
  // whenever new rows arrive the view gives way to them. Without this, a
  // revalidated page would carry on showing what the list was first handed.
  if (fromServer !== items) {
    setFromServer(items);
    setList(items);
  }

  const movable = (item: PlanItem) => item.status === "planned";
  const positions = list.map((item, i) => (movable(item) ? i : -1)).filter((i) => i >= 0);

  function commit(next: PlanItem[]) {
    setList(next);
    setError(null);
    const order = next.filter(movable).map((item) => item.id);
    start(async () => {
      const form = new FormData();
      form.set("order", JSON.stringify(order));
      const result = await reorderPlan({}, form);
      if (result.error) {
        setList(items);
        setError(result.error);
      }
    });
  }

  /** Swaps two sittings, and their slots with them. */
  function swap(a: number, b: number) {
    const next = [...list];
    const [one, two] = [next[a], next[b]];
    next[a] = { ...two, seq: one.seq };
    next[b] = { ...one, seq: two.seq };
    commit(next);
  }

  function move(index: number, by: -1 | 1) {
    const at = positions.indexOf(index);
    const to = positions[at + by];
    if (to === undefined) return;
    swap(index, to);
  }

  /** Dropping onto another movable card takes its place. */
  function dropOn(index: number) {
    if (dragging === null) return;
    const from = list.findIndex((item) => item.id === dragging);
    setDragging(null);
    if (from === -1 || from === index || !movable(list[index]) || !movable(list[from])) return;

    const next = [...list];
    const slots = positions.map((i) => next[i].seq);
    const order = positions.map((i) => next[i]);
    const [taken] = order.splice(positions.indexOf(from), 1);
    order.splice(positions.indexOf(index), 0, taken);
    positions.forEach((at, i) => {
      next[at] = { ...order[i], seq: slots[i] };
    });
    commit(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {positions.length > 1 && (
        <p className="text-sm text-muted">
          The sessions still to do can be put in any order — drag one, or use its arrows.
        </p>
      )}
      {error && <Alert>{error}</Alert>}

      <ol className="grid gap-4 lg:grid-cols-2">
        {list.map((item, index) => {
          const area = areaOf(item.sittingKey);
          const canMove = movable(item);
          const at = positions.indexOf(index);

          return (
            <li
              key={item.id}
              draggable={canMove}
              onDragStart={() => setDragging(item.id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => canMove && dragging && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(index);
              }}
              className={cx(
                "transition-opacity",
                dragging === item.id && "opacity-40",
                canMove && "cursor-grab active:cursor-grabbing",
              )}
            >
              <Card
                tone={item.status === "in_progress" ? "accent" : "plain"}
                className={cx("flex h-full flex-col gap-3 border-l-4", area.edge)}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <h2 className={cx("text-lg leading-snug", area.text)}>
                    <span className="mr-2.5 tabular-nums text-faint">{item.seq}</span>
                    {item.title}
                  </h2>
                  <Status status={item.status} />
                </div>

                <p className="text-sm leading-relaxed text-muted">{item.summary}</p>

                {item.status !== "done" && item.topics.length > 0 && <TopicChips topics={item.topics} />}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <span className="text-sm text-muted">
                    about {formatMinutes(item.minutes)}
                  </span>
                  {canMove && positions.length > 1 && (
                    <span className="flex items-center gap-0.5">
                      <Arrow
                        direction="up"
                        label={`Move ${item.title} earlier`}
                        disabled={at === 0}
                        onClick={() => move(index, -1)}
                      />
                      <Arrow
                        direction="down"
                        label={`Move ${item.title} later`}
                        disabled={at === positions.length - 1}
                        onClick={() => move(index, 1)}
                      />
                    </span>
                  )}
                </div>

                {canMove && <StartSitting sittingId={item.id} title={item.title} />}
                {item.status === "in_progress" && (
                  <ButtonLink href="/sitting" className="self-start">
                    Carry on with this one
                  </ButtonLink>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Arrow({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "up" | "down";
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="none">
        <path
          d={direction === "up" ? "M8 12.5V3.5M8 3.5 4 7.5M8 3.5l4 4" : "M8 3.5v9M8 12.5l-4-4M8 12.5l4-4"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function Status({ status }: { status: string }) {
  if (status === "done") return <Badge tone="recorded">Done</Badge>;
  if (status === "in_progress") return <Badge tone="accent">Open now</Badge>;
  if (status === "skipped") return <Badge>Skipped</Badge>;
  return <Badge tone="outstanding">To do</Badge>;
}
