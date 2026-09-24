// Grants or removes admin on an existing account.
// Run with: npm run make-admin -- someone@example.com [--remove]
//
// Roles are deliberately not settable through the app: the auth config marks
// the field `input: false`, so this script (or SQL) is the only way in.

import pg from "pg";

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const email = args.find((a) => !a.startsWith("--"));

if (!email) {
  console.error("Usage: npm run make-admin -- someone@example.com [--remove]");
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED is not set.");
  process.exit(1);
}

const role = remove ? "user" : "admin";
const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows } = await client.query(
  'update "user" set role = $1 where lower(email) = lower($2) returning email, role',
  [role, email],
);
await client.end();

if (!rows.length) {
  console.error(`No account found for ${email}.`);
  process.exit(1);
}
console.log(`${rows[0].email} is now: ${rows[0].role}`);
