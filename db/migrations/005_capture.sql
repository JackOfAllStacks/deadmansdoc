-- What a sitting captures.
--
-- field_values already treats an unanswered field as content rather than a
-- blank: status 'unknown' with who_would_know is the routed gap. What's added
-- here is how sure we are, what the family has to do about it, and how much it
-- matters that a gap is still open.

alter table field_values
  -- What someone who has never touched this will actually have to DO. Plain
  -- terms, and "nothing, it's automatic" is a real answer worth recording.
  add column family_action text,
  add column confidence text not null default 'stated'
    check (confidence in ('stated', 'uncertain', 'inferred')),
  -- Only meaningful when status = 'unknown'. How much worse this gap gets if
  -- nobody closes it.
  add column gap_priority text
    check (gap_priority in ('high', 'medium', 'low'));

-- Repeated mentions of the same person are normal in conversation -- the model
-- re-confirms someone almost every turn. Without this they pile up as
-- duplicate rows, which is a mistake the fork made first and paid for.
create unique index entity_instances_label_unique
  on entity_instances (record_id, entity_type, lower(label));

-- Things worth keeping that no v1 field covers. The fields keep the printed
-- artifact predictable; this keeps what they'd otherwise drop on the floor.
create table overflow_notes (
  id                 uuid primary key default gen_random_uuid(),
  record_id          uuid not null references records(id) on delete cascade,
  sitting_id         uuid references sittings(id) on delete set null,
  -- Short and stable, so the same thing updates rather than duplicating.
  label              text not null,
  value              text not null,
  family_action      text,
  confidence         text not null default 'stated'
                       check (confidence in ('stated', 'uncertain', 'inferred')),
  source_message_id  uuid references messages(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (record_id, label)
);

create index on overflow_notes (record_id);

-- What the sitting was like, for whoever runs the next one.
alter table sittings
  add column summary text,
  -- Set while a reply is being generated, so a double-submit can't run two
  -- model calls at once. Expires on its own if a request dies.
  add column busy_until timestamptz;

-- question_asks is written by the server from what the tools did, never by the
-- model, so the same question can be recorded again in a later sitting.
create index on question_asks (record_id, outcome);
