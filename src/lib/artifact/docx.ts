import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  type ISectionOptions,
} from "docx";
import type { Doc, DocSection, Entry } from "@/lib/artifact/doc";
import { parseInline } from "@/lib/artifact/inline";

/*
 * The document as a Word file.
 *
 * Markdown was what came out of here first, and it is the wrong thing to hand
 * someone: the people this is written for open it on a laptop they share with
 * a grandchild, and a .md file either opens as code or doesn't open at all.
 * This is the same Doc -- nothing is decided here that isn't already decided
 * in render.ts -- set to be read on paper or in Word.
 */

// Word's own Heading styles carry outline levels, which is what gives the file
// a navigation pane and a table of contents if anyone wants one.
const QUIET = "595959";
const BULLETS = "handover-bullets";
const STEPS = "handover-steps";

function runs(text: string, quiet = false): TextRun[] {
  return parseInline(text).map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.mark === "strong",
        color: quiet || run.mark === "quiet" ? QUIET : undefined,
      }),
  );
}

function entryParagraphs(entry: Entry): Paragraph[] {
  const out = entry.lines.map(
    (line) =>
      new Paragraph({
        children: runs(line),
        spacing: { after: 60 },
        ...(entry.shape === "para"
          ? {}
          : { numbering: { reference: entry.shape === "steps" ? STEPS : BULLETS, level: 0 } }),
      }),
  );

  // What the family has to do about it, and how sure anyone was: set quieter,
  // the same as on the page.
  for (const aside of entry.asides) {
    out.push(
      new Paragraph({
        children: runs(aside, true),
        indent: { left: 360 },
        spacing: { after: 60 },
      }),
    );
  }
  return out;
}

function sectionParagraphs(section: DocSection): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      text: section.heading,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 160 },
    }),
  ];

  for (const part of section.parts) {
    if (part.heading) {
      out.push(
        new Paragraph({
          text: part.heading,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
        }),
      );
    }
    for (const entry of part.entries) out.push(...entryParagraphs(entry));
  }

  if (section.note) out.push(new Paragraph({ children: runs(section.note, true), spacing: { before: 120 } }));
  return out;
}

function frontMatter(doc: Doc): Paragraph[] {
  return [
    new Paragraph({ text: doc.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({
      children: runs(`For ${doc.forWhom}`, true),
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
    }),
    new Paragraph({
      children: runs(`Prepared ${doc.prepared} · Version ${doc.version}`, true),
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({ children: runs(doc.framing), spacing: { after: 160 } }),
    new Paragraph({ children: runs(doc.disclaimer, true), spacing: { after: 240 } }),
  ];
}

export async function toDocx(doc: Doc): Promise<Buffer> {
  const section: ISectionOptions = {
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    children: [...frontMatter(doc), ...doc.sections.flatMap(sectionParagraphs)],
  };

  const file = new Document({
    title: doc.title,
    description: doc.framing,
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 180 } } },
            },
          ],
        },
        {
          reference: STEPS,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 180 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } },
      },
    },
    sections: [section],
  });

  return Packer.toBuffer(file);
}
