// The model both conversations use, in one place so switching is one line.
//
// Sonnet rather than Opus: this is warm, careful conversation with small
// structured tool calls, not hard reasoning, and a record runs to roughly
// forty model calls across its sittings. Revisit if capture quality drops --
// the end-to-end script in scripts/ is how that gets judged, not a hunch.
export const MODEL = "claude-sonnet-5";
