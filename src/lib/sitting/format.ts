// Turning what a tool call captured into display text. Pure, and deliberately
// its own module rather than living in capture.ts: agent.ts needs it too, and
// capture.ts is mocked wholesale in tests that exercise agent.ts.

// A field's value is prose, a list, or (for a "people" field) the names it
// points at -- formatted the same way wherever it's shown, live or reloaded.
export function formatFieldText(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value;
  return "";
}

// An entity's own name is shown as the label; this is the rest of what's
// known about it, e.g. "husband · would be there in person".
export function formatEntityText(data: Record<string, string> | null | undefined): string {
  if (!data) return "";
  return Object.entries(data)
    .filter(([key, value]) => key !== "name" && value)
    .map(([, value]) => value)
    .join(" · ");
}
