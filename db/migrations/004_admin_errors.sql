-- Admin accounts, and a durable record of failures.

-- Role lives on the Better Auth user table. `input: false` in the auth config
-- stops anyone sending a role at sign-up, so this only ever changes here or
-- through scripts/make-admin.mjs.
alter table "user"
  add column role text not null default 'user'
    check (role in ('user', 'admin'));

-- Every failed model call or agent turn, whatever the person was shown at the
-- time. Netlify's function logs are per-deploy and awkward to search after the
-- fact; this is queryable, and it outlives the deploy that produced it.
--
-- Nothing the person typed goes in here. `message` is the provider's or our
-- own error text, which is why a row can safely outlive the record it came
-- from: both references null out rather than cascading.
create table error_logs (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid references records(id) on delete set null,
  user_id      text references "user"(id) on delete set null,
  -- Where it happened, e.g. 'intake:turn'.
  context      text not null,
  -- Coarse kind, so a glance at the list tells you what sort of problem this
  -- was: rate_limit, overloaded, auth, bad_request, server_error,
  -- network_error, app_error.
  error_type   text not null default 'unknown',
  -- HTTP status, when the provider actually answered.
  status_code  integer,
  -- The model that served the request; with fallbacks on, not always the one
  -- we asked for.
  model        text,
  duration_ms  integer,
  message      text not null,
  created_at   timestamptz not null default now()
);

create index on error_logs (created_at desc);
create index on error_logs (error_type, created_at desc);
