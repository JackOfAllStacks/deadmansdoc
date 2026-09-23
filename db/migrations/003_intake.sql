-- The opening conversation and the plan of sittings.

-- Better Auth owns a table called "session" (logins). Ours were planned
-- sittings, so rename to stop the two being confused. Constraint and index
-- names keep their old sessions_* prefix; they're never referenced by name.
alter table sessions rename to sittings;
alter table sittings rename column section_ids to covers;
alter table messages rename column session_id to sitting_id;
alter table question_asks rename column session_id to sitting_id;

-- Which entry in data/session-template.yaml this sitting came from.
alter table sittings add column sitting_key text;

alter table records
  add column subject_relationship text
    check (subject_relationship in ('self', 'parent', 'other')),
  -- Signals gathered by the opening conversation, merged as they arrive.
  add column intake jsonb not null default '{}'::jsonb,
  add column intake_completed_at timestamptz,
  -- Who was in the room when consent was given.
  add column present jsonb not null default '[]'::jsonb,
  -- Set while an intake reply is being generated, so a double-submit can't
  -- run two model calls at once. Expires on its own if a request dies.
  add column intake_busy_until timestamptz;

-- phase separates the opening conversation from later sittings. blocks holds
-- the full API content (text, thinking, tool use, tool results) so history can
-- be replayed exactly; content stays the readable text.
alter table messages
  add column phase text not null default 'sitting'
    check (phase in ('intake', 'sitting')),
  add column blocks jsonb,
  -- created_at can tie within one reply; position gives a stable order.
  add column position bigint generated always as identity;

alter table messages drop constraint messages_role_check;
alter table messages add constraint messages_role_check
  check (role in ('agent', 'subject', 'helper', 'tool'));

create index on messages (record_id, phase, position);
