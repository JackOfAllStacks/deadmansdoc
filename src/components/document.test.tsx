import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { inline } from "./document";

const html = (text: string) => renderToStaticMarkup(<>{inline(text)}</>);

describe("inline marks", () => {
  it("leaves plain text alone", () => {
    expect(html("Call Robyn first.")).toBe("Call Robyn first.");
  });

  it("sets a name in bold, the way an entity prints", () => {
    expect(html("**Robyn** — relationship: wife")).toContain("<strong");
    expect(html("**Robyn** — relationship: wife")).toContain("Robyn</strong>");
  });

  it("sets a gap back rather than italicising it", () => {
    // The documents use _quiet_ for asides and gaps. Italics at that length
    // are harder to read, so it reads as a quieter voice, not a slanted one.
    const out = html("_Not yet known. — Robyn may know._");
    expect(out).toContain("not-italic");
    expect(out).toContain("Not yet known. — Robyn may know.");
  });

  it("handles a line carrying both marks", () => {
    const out = html("**Pete** — _not spoken to in years_");
    expect(out).toContain("<strong");
    expect(out).toContain("<em");
  });

  it("doesn't mangle an underscore inside a word", () => {
    expect(html("field s5.bill_account")).toBe("field s5.bill_account");
  });

  it("leaves an unpaired mark as the characters it is", () => {
    expect(html("2 ** 3 is not emphasis")).toBe("2 ** 3 is not emphasis");
  });
});
