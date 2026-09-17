# Security & privacy notes (prototype)

This prototype is built for synthetic personas only. It is **not** safe to put
real personal data into as-is. What's in place, and what a real deployment
would still need:

## In place
- No secrets in the repo: DB connection string and LLM key are read from
  environment variables (`DATABASE_URL`, `LLM_API_KEY`) only.
- A `visibility` column already exists on `facts` (`family` /
  `executor_only` / `after_death_only`) so the schema doesn't have to change
  later for the "asymmetric disclosure" idea in the brief (an elderly subject
  recording something their family can't see until after death). It is
  **captured but not enforced** anywhere yet.

## Not in place (needed before any real data)
- **Access control.** There is no authentication. The "resume code" is a
  convenience for a single prototype user, not a credential -- anyone with
  the code can read or add to that record. A real version needs real auth
  and per-record ownership.
- **Encryption at rest / in transit for sensitive fields.** Neon encrypts at
  rest at the infra level, but there's no application-level encryption of
  especially sensitive fields (e.g. anything under `physical-access` or
  `credentials` categories).
- **Enforcement of `visibility`.** Nothing currently checks it before
  returning data -- it's a placeholder for the access model, not a working
  control.
- **Death/incapacity trigger.** No mechanism exists for who unlocks the
  record, on what evidence, or how "after_death_only" data actually becomes
  visible. This is a genuine open design question (see the brief), not
  something to fake here.
- **Audit trail.** No record of who viewed what, when.
- **Data retention / deletion.** No user-facing way to delete a record.

## LLM provider
The LLM adapter (`src/llm.js`) talks to any OpenAI-compatible chat-completions
endpoint, configured entirely through `LLM_BASE_URL` / `LLM_API_KEY` /
`LLM_MODEL`. It currently defaults to an open-weight model via Groq for
prototyping cost reasons. Whatever provider is used, conversation content
(which may include sensitive synthetic-persona data) is sent to that
provider's API -- treat the provider choice as part of the data-handling
story, not just a cost decision, once this moves past synthetic personas.
