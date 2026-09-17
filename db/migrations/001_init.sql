-- The Handover — initial schema
--
-- field_id and question_id are text references into data/artifact-fields.yaml
-- and data/question-bank.yaml. Those files are the source of truth and are not
-- mirrored into tables: the bank is still being whittled down, and keeping it
-- in one place avoids a sync problem nobody would remember to solve. The cost
-- is that the database cannot enforce those references; the app validates them
-- on load instead.
--
-- Requires Postgres 15+ for NULLS NOT DISTINCT. Neon is well past that.

create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);

-- The subject: the person the document is about. One account owns it, and the
-- adult child sits alongside rather than holding a login of their own.
create table records (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid not null references users(id) on delete cascade,
  subject_name      text not null,
  status            text not null default 'draft'
                      check (status in ('draft', 'active', 'complete')),
  consent_given_at  timestamptz,
  consent_note      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One planned sitting. The session plan is just these rows ordered by seq:
-- the set of domains is the same for everyone, while the estimate and the
-- order are derived per user from the opening questionnaire.
create table sessions (
  id                 uuid primary key default gen_random_uuid(),
  record_id          uuid not null references records(id) on delete cascade,
  seq                integer not null,
  title              text not null,
  section_ids        text[] not null default '{}',
  estimated_minutes  integer,
  scheduled_for      date,
  status             text not null default 'planned'
                       check (status in ('planned', 'in_progress', 'done', 'skipped')),
  started_at         timestamptz,
  completed_at       timestamptz,
  -- Who was in the room. Free-form because the people present are often not
  -- the people recorded elsewhere in the document.
  present            jsonb not null default '[]'::jsonb,
  unique (record_id, seq)
);

create table messages (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references records(id) on delete cascade,
  session_id  uuid references sessions(id) on delete set null,
  role        text not null check (role in ('agent', 'subject', 'helper')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index on messages (record_id, created_at);

-- What has already been put to the subject, so the agent doesn't repeat itself
-- across sittings. Kept separate from field_values because a question can be
-- asked and yield nothing, which is still worth remembering.
create table question_asks (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references records(id) on delete cascade,
  session_id   uuid references sessions(id) on delete set null,
  question_id  text not null,
  asked_at     timestamptz not null default now(),
  outcome      text not null default 'answered'
                 check (outcome in ('answered', 'unknown', 'skipped', 'deferred'))
);

create index on question_asks (record_id, question_id);

-- Instances of a repeated record: a person, an account, a bill, a debt, an
-- income stream. entity_type matches a key under `entities` in
-- artifact-fields.yaml; data holds that shape.
create table entity_instances (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references records(id) on delete cascade,
  entity_type  text not null,
  label        text not null,
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index on entity_instances (record_id, entity_type);

-- The artifact itself, one row per filled field.
--
-- A row with status 'unknown' is a gap, and gaps are content: an unanswered
-- field carrying who_would_know is more useful than a blank, and the set of
-- them is the prioritised go-and-find-out list.
--
-- disclosure defaults from the field definition but is stored per value,
-- because sealing is the subject's choice and can differ from the default.
create table field_values (
  id                  uuid primary key default gen_random_uuid(),
  record_id           uuid not null references records(id) on delete cascade,
  field_id            text not null,
  -- Set when the field belongs to one instance of a repeated record, such as
  -- the balance of a particular account. Null for record-wide fields.
  entity_instance_id  uuid references entity_instances(id) on delete cascade,
  value               jsonb,
  status              text not null default 'answered'
                        check (status in ('answered', 'unknown', 'skipped')),
  disclosure          text not null default 'open'
                        check (disclosure in ('open', 'sealed', 'pointer')),
  who_would_know      text,
  -- The message this was drawn from, so the document can be traced back to
  -- what the person actually said.
  source_message_id   uuid references messages(id) on delete set null,
  updated_at          timestamptz not null default now(),

  unique nulls not distinct (record_id, field_id, entity_instance_id)
);

create index on field_values (record_id);
create index on field_values (record_id, status);
