// Tool (function-calling) definitions the LLM uses to write structured data
// into the record as the conversation happens, instead of us trying to parse
// free text out of a transcript after the fact.
const db = require("./db");
const questionBank = require("./data/questionBank.json");

const CATEGORIES = questionBank.categories;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "save_person",
      description:
        "Record or update a person who matters to the handover: someone the family would need to contact, who holds knowledge or access, or who has a role (executor, financial advisor, etc). Call this as soon as a person is mentioned with enough detail to be useful -- do not wait until the end of the conversation.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The person's name." },
          relationship: {
            type: "string",
            description: "Their relationship to the subject, e.g. 'daughter', 'financial advisor', 'neighbour'.",
          },
          roles: {
            type: "array",
            items: { type: "string" },
            description:
              "Any functional roles this person holds, e.g. 'executor', 'backup executor', 'holds spare key', 'financial advisor', 'first call'.",
          },
          scope_of_authority: {
            type: "string",
            description: "What this person is actually authorised or able to do, if relevant (e.g. 'joint signatory on bank account', 'has power of attorney').",
          },
          what_they_hold_or_oversee: {
            type: "string",
            description: "What knowledge, documents, access or responsibility this person holds or oversees.",
          },
          contact_phone: { type: "string" },
          contact_email: { type: "string" },
          contact_other: { type: "string", description: "Any other way to reach them, or notes on reachability." },
          is_reachable: {
            type: "boolean",
            description: "Whether the subject is confident this contact info is current and this person is reachable.",
          },
          notes: { type: "string", description: "Anything else worth keeping about this person." },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_fact",
      description:
        "Record one discrete piece of handover information: a fact, instruction, location, or answer the subject has given. Call this every time a concrete, useful answer is given -- one fact per call. Use a short, stable 'label' so the same fact can be updated later rather than duplicated (e.g. label 'safe deposit box location', not a full sentence).",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: CATEGORIES,
            description: "Which part of the handover this belongs to.",
          },
          label: {
            type: "string",
            description: "A short, stable name for this specific fact, e.g. 'mortgage lender', 'gas provider', 'safe combination location'.",
          },
          value: { type: "string", description: "The answer or information itself." },
          notes: { type: "string", description: "Extra context, caveats, or texture that doesn't fit in value." },
          confidence: {
            type: "string",
            enum: ["stated", "uncertain", "inferred"],
            description: "'stated' if the subject said it plainly, 'uncertain' if they hedged, 'inferred' if you deduced it.",
          },
          source: {
            type: "string",
            enum: ["self", "parent", "other"],
            description: "Who this information came from in this conversation.",
          },
        },
        required: ["category", "label", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "flag_gap",
      description:
        "Record a gap: something important the subject does NOT currently know or have, ideally with who might know instead. Use this for every 'I don't know' rather than letting it disappear -- a routed gap is valuable output even without an answer.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: CATEGORIES },
          description: { type: "string", description: "What is missing or unknown." },
          who_would_know: {
            type: "string",
            description: "Who might know this instead, if the subject has any idea (a person, institution, or 'no one knows').",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "How much worse this gap gets if it's not resolved before something happens (e.g. a safe deposit box access issue is high).",
          },
        },
        required: ["category", "description"],
      },
    },
  },
];

async function executeToolCall(recordId, name, args) {
  switch (name) {
    case "save_person": {
      const person = await db.upsertPerson({
        recordId,
        name: args.name,
        relationship: args.relationship,
        roles: args.roles,
        scopeOfAuthority: args.scope_of_authority,
        whatTheyHoldOrOversee: args.what_they_hold_or_oversee,
        contactDetails: {
          phone: args.contact_phone,
          email: args.contact_email,
          other: args.contact_other,
        },
        isReachable: args.is_reachable,
        notes: args.notes,
      });
      return { ok: true, saved: "person", id: person.id };
    }
    case "save_fact": {
      const fact = await db.upsertFact({
        recordId,
        category: args.category,
        label: args.label,
        value: args.value,
        notes: args.notes,
        confidence: args.confidence,
        source: args.source,
      });
      return { ok: true, saved: "fact", id: fact.id };
    }
    case "flag_gap": {
      const gap = await db.addGap({
        recordId,
        category: args.category,
        description: args.description,
        whoWouldKnow: args.who_would_know,
        priority: args.priority,
      });
      return { ok: true, saved: "gap", id: gap.id };
    }
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

module.exports = { TOOLS, executeToolCall };
