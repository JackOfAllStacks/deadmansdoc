import PDFDocument from "pdfkit";
import type { Doc, DocSection, Entry } from "@/lib/artifact/doc";
import { parseInline } from "@/lib/artifact/inline";

/*
 * The document as a PDF.
 *
 * The same Doc the page renders and the Word file is built from, so nothing
 * about what appears is decided here -- only how it sits on a page. It uses
 * the standard PDF fonts rather than embedding any, which keeps the file
 * small and means nothing has to be shipped alongside it to render.
 */

const PAGE = { size: "A4" as const, margin: 56 };
const INK = "#1c1917";
const QUIET = "#5d564e";
const LINE = "#d3c9bb";

const BODY = "Helvetica";
const BOLD = "Helvetica-Bold";

type Pdf = InstanceType<typeof PDFDocument>;

/** The width left for text at the current indent. */
const widthAt = (pdf: Pdf, indent: number) =>
  pdf.page.width - pdf.page.margins.left - pdf.page.margins.right - indent;

/**
 * One line, with the two inline marks applied. Written as a run of pieces so
 * **a name** stays bold inside the sentence it sits in.
 */
function writeLine(pdf: Pdf, text: string, options: { indent?: number; quiet?: boolean; gap?: number } = {}) {
  const indent = options.indent ?? 0;
  const runs = parseInline(text);
  pdf.x = pdf.page.margins.left + indent;

  runs.forEach((run, i) => {
    const last = i === runs.length - 1;
    pdf.font(run.mark === "strong" ? BOLD : BODY)
      .fontSize(10.5)
      .fillColor(options.quiet || run.mark === "quiet" ? QUIET : INK)
      .text(run.text, { continued: !last, width: widthAt(pdf, indent), lineGap: 1.5 });
  });

  if (!runs.length) pdf.moveDown(0.5);
  if (options.gap) pdf.moveDown(options.gap);
  pdf.x = pdf.page.margins.left;
}

/** A new page rather than a heading stranded at the foot of this one. */
function keepTogether(pdf: Pdf, needed: number) {
  const bottom = pdf.page.height - pdf.page.margins.bottom;
  if (pdf.y + needed > bottom) pdf.addPage();
}

function writeEntry(pdf: Pdf, entry: Entry) {
  entry.lines.forEach((line, i) => {
    if (entry.shape === "para") {
      writeLine(pdf, line, { gap: 0.4 });
      return;
    }
    // The marker sits in the margin of the text, so a wrapped line lines up
    // under the words rather than under the bullet.
    const marker = entry.shape === "steps" ? `${i + 1}.` : "•";
    const top = pdf.y;
    pdf.font(BODY).fontSize(10.5).fillColor(QUIET).text(marker, pdf.page.margins.left + 6, top, { lineBreak: false });
    pdf.y = top;
    writeLine(pdf, line, { indent: 24, gap: 0.3 });
  });

  for (const aside of entry.asides) writeLine(pdf, aside, { indent: 24, quiet: true, gap: 0.35 });
  pdf.moveDown(0.25);
}

function writeSection(pdf: Pdf, section: DocSection) {
  keepTogether(pdf, 90);
  pdf.moveDown(0.8);
  pdf.font(BOLD).fontSize(14).fillColor(INK).text(section.heading, pdf.page.margins.left, pdf.y);
  pdf.moveDown(0.3);

  const y = pdf.y;
  pdf
    .moveTo(pdf.page.margins.left, y)
    .lineTo(pdf.page.width - pdf.page.margins.right, y)
    .lineWidth(0.75)
    .strokeColor(LINE)
    .stroke();
  pdf.moveDown(0.6);

  for (const part of section.parts) {
    if (part.heading) {
      keepTogether(pdf, 60);
      pdf.moveDown(0.3);
      pdf.font(BOLD).fontSize(10).fillColor(QUIET).text(part.heading, pdf.page.margins.left, pdf.y);
      pdf.moveDown(0.3);
    }
    for (const entry of part.entries) writeEntry(pdf, entry);
  }

  if (section.note) writeLine(pdf, section.note, { quiet: true, gap: 0.4 });
}

function writeFrontMatter(pdf: Pdf, doc: Doc) {
  pdf.font(BOLD).fontSize(22).fillColor(INK).text(doc.title, { align: "center" });
  pdf.moveDown(0.5);
  pdf
    .font(BODY)
    .fontSize(10)
    .fillColor(QUIET)
    .text(`For ${doc.forWhom}`, { align: "center" })
    .text(`Prepared ${doc.prepared} · Version ${doc.version}`, { align: "center" });
  pdf.moveDown(1.2);

  writeLine(pdf, doc.framing, { gap: 0.5 });
  writeLine(pdf, doc.disclaimer, { quiet: true, gap: 0.6 });

  const y = pdf.y;
  pdf
    .moveTo(pdf.page.margins.left, y)
    .lineTo(pdf.page.width - pdf.page.margins.right, y)
    .lineWidth(0.75)
    .strokeColor(LINE)
    .stroke();
}

/** Page numbers, written once at the end over the pages that exist. */
function numberPages(pdf: Pdf, title: string) {
  const range = pdf.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    pdf.switchToPage(i);
    // The footer sits below the bottom margin, and writing there is what
    // pdfkit treats as running out of page -- so the margin comes off for
    // exactly as long as it takes to write, or every footer adds a blank page.
    const bottom = pdf.page.margins.bottom;
    pdf.page.margins.bottom = 0;
    pdf
      .font(BODY)
      .fontSize(8.5)
      .fillColor(QUIET)
      .text(`${title} · page ${i - range.start + 1} of ${range.count}`, pdf.page.margins.left, pdf.page.height - bottom + 16, {
        width: pdf.page.width - pdf.page.margins.left - pdf.page.margins.right,
        align: "center",
        lineBreak: false,
      });
    pdf.page.margins.bottom = bottom;
  }
}

export function toPdf(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // bufferPages, so the page count is known by the time the footers are
    // written -- it isn't until the last line has landed.
    const pdf = new PDFDocument({
      ...PAGE,
      bufferPages: true,
      info: { Title: doc.title, Subject: doc.framing },
    });

    const chunks: Buffer[] = [];
    pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    try {
      writeFrontMatter(pdf, doc);
      for (const section of doc.sections) writeSection(pdf, section);
      numberPages(pdf, doc.title);
      pdf.end();
    } catch (err) {
      reject(err);
    }
  });
}
