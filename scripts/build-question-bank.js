// Compiles Discovery/Questions/*.md and Discovery/Question Brainstorming/Question Framing Techniques.md
// into JSON/text the server-side code can import. Re-run this whenever discovery content changes:
//   node scripts/build-question-bank.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const QUESTIONS_DIR = path.join(ROOT, "Discovery", "Questions");
const FRAMING_FILE = path.join(
  ROOT,
  "Discovery",
  "Question Brainstorming",
  "Question Framing Techniques.md"
);
const OUT_DIR = path.join(ROOT, "src", "data");

const TAG_PREFIX = "dead-mans-doc/questions/";

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { tags: [], body: raw.trim() };
  const [, frontmatter, body] = match;
  const tags = [];
  const tagBlockMatch = frontmatter.match(/tags:\s*\n((?:\s*-\s*.+\n?)*)/);
  if (tagBlockMatch) {
    for (const line of tagBlockMatch[1].split("\n")) {
      const tagMatch = line.match(/-\s*(\S+)/);
      if (tagMatch) tags.push(tagMatch[1]);
    }
  }
  return { tags, body: body.trim() };
}

function slugify(filename) {
  return filename
    .replace(/\.md$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildQuestionBank() {
  const files = fs
    .readdirSync(QUESTIONS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const questions = files.map((file) => {
    const raw = fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf8");
    const { tags, body } = parseFrontmatter(raw);
    const categories = tags
      .filter((t) => t.startsWith(TAG_PREFIX))
      .map((t) => t.slice(TAG_PREFIX.length));
    return {
      id: slugify(file),
      title: file.replace(/\.md$/, ""),
      categories: categories.length ? categories : ["uncategorised"],
      question: body,
    };
  });

  const categorySet = new Set();
  questions.forEach((q) => q.categories.forEach((c) => categorySet.add(c)));
  const categories = Array.from(categorySet).sort();

  return { categories, questions };
}

function buildFramingTechniques() {
  const raw = fs.readFileSync(FRAMING_FILE, "utf8");
  const { body } = parseFrontmatter(raw);
  return body;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bank = buildQuestionBank();
  fs.writeFileSync(
    path.join(OUT_DIR, "questionBank.json"),
    JSON.stringify(bank, null, 2)
  );

  const framing = buildFramingTechniques();
  // Written as a JS module (not a .md read at runtime via fs) so bundlers
  // that package Netlify Functions (which only follow require() graphs, not
  // fs.readFileSync calls) actually include this content in the deployed
  // function.
  fs.writeFileSync(
    path.join(OUT_DIR, "framingTechniques.js"),
    `module.exports = ${JSON.stringify(framing)};\n`
  );

  console.log(
    `Wrote ${bank.questions.length} questions across ${bank.categories.length} categories to ${OUT_DIR}`
  );
}

main();
