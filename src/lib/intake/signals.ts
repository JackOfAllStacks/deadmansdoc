import { z } from "zod";

// Must match the `key`s in data/session-template.yaml; content validation
// checks this at build time.
export const SITTING_KEYS = ["people", "first-days", "money-out", "money-in-owed"] as const;
export type SittingKey = (typeof SITTING_KEYS)[number];

export const ACCOUNT_BANDS = ["0-1", "2-4", "5+"] as const;

// What the opening conversation is trying to establish. Every field is
// nullable: null means "not learned yet", and never overwrites a known value.
// No numeric bounds here — strict tool schemas don't accept them — so ranges
// are checked in applySignalUpdate instead.
export const signalUpdateSchema = z
  .object({
    family_count: z
      .number()
      .int()
      .nullable()
      .describe("Number of people in their immediate family (partner, children, siblings, parents still living)."),
    adviser_count: z
      .number()
      .int()
      .nullable()
      .describe("Number of professionals they rely on: accountant, lawyer, financial adviser, and similar."),
    account_band: z
      .enum(ACCOUNT_BANDS)
      .nullable()
      .describe("Roughly how many bank, card and investment accounts they hold."),
    runs_household_money_alone: z
      .boolean()
      .nullable()
      .describe("True if they are the only person who handles the household's money."),
    has_business_or_trust: z
      .boolean()
      .nullable()
      .describe("True if they own or run a business, or hold anything through a company or trust."),
    has_debts_or_guarantees: z
      .boolean()
      .nullable()
      .describe("True for a mortgage, loans, credit cards, private debts, or guarantees for someone else."),
    has_income_after_death: z
      .boolean()
      .nullable()
      .describe("True if money would keep arriving after they die: distributions, royalties, business payments, refunds."),
    has_time_constrained_rites: z
      .boolean()
      .nullable()
      .describe("True if religious or cultural practice requires things to happen within a set time after death."),
    has_matters_in_progress: z
      .boolean()
      .nullable()
      .describe("True if something is under way now: a sale, a claim, a court matter, a building project."),
    mentioned_sittings: z
      .array(z.enum(SITTING_KEYS))
      .describe(
        "Topics this message raised without being asked about them, in the order raised. " +
          "An answer to the question you just asked doesn't count. Empty if none. " +
          "people = family and who to call; first-days = what must happen quickly after death; " +
          "money-out = accounts and bills; money-in-owed = debts, and money still to come in.",
      ),
  })
  .strict();

export type SignalUpdate = z.infer<typeof signalUpdateSchema>;

export type Signals = Omit<Partial<{ [K in keyof SignalUpdate]: NonNullable<SignalUpdate[K]> }>, "mentioned_sittings"> & {
  front_of_mind?: SittingKey[];
  summary?: string;
};

const MAX_COUNT = 100;

// Merge one update into the stored signals. Returns an error message instead
// when a value is out of range, so the tool call can be answered with it.
export function applySignalUpdate(current: Signals, update: SignalUpdate): Signals | string {
  for (const key of ["family_count", "adviser_count"] as const) {
    const value = update[key];
    if (value !== null && (value < 0 || value > MAX_COUNT)) {
      return `${key} must be between 0 and ${MAX_COUNT}`;
    }
  }

  const next: Signals = { ...current };
  const { mentioned_sittings, ...values } = update;
  for (const [key, value] of Object.entries(values)) {
    if (value !== null) (next as Record<string, unknown>)[key] = value;
  }

  const seen = [...(current.front_of_mind ?? [])];
  for (const key of mentioned_sittings) {
    if (!seen.includes(key)) seen.push(key);
  }
  if (seen.length) next.front_of_mind = seen;
  return next;
}

export const finishSchema = z
  .object({
    summary: z
      .string()
      .describe("Two or three plain sentences on what stood out, for whoever runs the later sittings."),
  })
  .strict();

// Numeric bounds aren't accepted in strict tool schemas, and zod's .int()
// adds safe-integer bounds on its own.
const UNSUPPORTED_KEYWORDS = new Set(["$schema", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]);

function stripUnsupported(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUnsupported);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !UNSUPPORTED_KEYWORDS.has(key))
        .map(([key, v]) => [key, stripUnsupported(v)]),
    );
  }
  return value;
}

// Tool input schemas for the API, generated from the zod schemas above.
export function toToolSchema(schema: z.ZodType) {
  return stripUnsupported(z.toJSONSchema(schema, { target: "draft-7" })) as {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}
