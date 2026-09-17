// One-off migration runner: applies db/schema.sql to the Neon database in
// DATABASE_URL. Safe to re-run (everything is CREATE ... IF NOT EXISTS).
//   node db/migrate.js
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { Client } = require("@neondatabase/serverless");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in,");
    console.error("or export DATABASE_URL before running this script.");
    process.exit(1);
  }

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const client = new Client(process.env.DATABASE_URL);
  await client.connect();
  try {
    await client.query(schema);
    console.log("Schema applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
