// Applies db/migrations/*.sql in filename order, once each.
// Run with: npm run migrate

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

// Schema changes need the direct connection; the pooled one drops sessions
// between statements in ways that break DDL.
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.error('DATABASE_URL_UNPOOLED is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

await client.query(`
  create table if not exists _migrations (
    name        text primary key,
    applied_at  timestamptz not null default now()
  )
`);

const { rows } = await client.query('select name from _migrations');
const done = new Set(rows.map((r) => r.name));
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

let applied = 0;
for (const file of files) {
  if (done.has(file)) continue;

  const sql = await readFile(join(dir, file), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into _migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log(`applied  ${file}`);
    applied++;
  } catch (err) {
    await client.query('rollback');
    console.error(`failed   ${file}\n${err.message}`);
    await client.end();
    process.exit(1);
  }
}

console.log(applied ? `\n${applied} migration(s) applied.` : 'Already up to date.');
await client.end();
