import { artifact, type FieldType } from "@/lib/content";
import type { CapturedItem } from "@/lib/sitting/capture";
import { sittingFields } from "@/lib/sitting/coverage";
import { attributeKeysFor, entityTypeFor } from "@/lib/sitting/schema";

// The document view beside a sitting's conversation: the fields this sitting
// can fill, grouped the way the finished Guide groups them (section, then
// group where there is one), each starting empty and filling in as the
// conversation goes -- and each editable in place, the same shape whether the
// edit came from a tool call or from someone correcting it by hand. Field
// order follows a sitting's `covers`, but grouping follows the artifact's own
// section/group titles, not the order `covers` happens to list them in.

export interface DocumentEntry {
  kind: "field" | "entity" | "amount" | "gap" | "note";
  /** The entity this entry is, or is about; null for a plain field, gap or note. */
  entityId: string | null;
  /** An entity's or amount's own name; empty for a plain field or gap. */
  label: string;
  text: string | null;
  /** family_action, or who_would_know for a gap. */
  detail: string | null;
  /** An entity's raw attributes, for prefilling an edit form. Null otherwise. */
  attributes: Record<string, string> | null;
}

export interface DocumentFieldView {
  id: string;
  label: string;
  type: FieldType;
  /** Set only for type "entities": which shape its entries take. */
  entityType: string | null;
  attributeKeys: string[];
  /** True for a sealed figure -- edited, but never pre-filled with what's there. */
  sealed: boolean;
  entries: DocumentEntry[];
}

export interface DocumentGroupView {
  title: string | null;
  fields: DocumentFieldView[];
}

export interface DocumentSectionView {
  id: string;
  title: string;
  groups: DocumentGroupView[];
}

interface FieldLocation {
  sectionId: string;
  sectionTitle: string;
  groupTitle: string | null;
}

const fieldLocation = new Map<string, FieldLocation>();
for (const section of artifact.sections) {
  for (const field of section.fields ?? []) {
    fieldLocation.set(field.id, { sectionId: section.id, sectionTitle: section.title, groupTitle: null });
  }
  for (const group of section.groups ?? []) {
    for (const field of group.fields) {
      fieldLocation.set(field.id, { sectionId: section.id, sectionTitle: section.title, groupTitle: group.title });
    }
  }
}

export function documentOutline(covers: string[], captured: CapturedItem[]): DocumentSectionView[] {
  const byField = new Map<string, CapturedItem[]>();
  for (const item of captured) {
    if (!item.fieldId) continue;
    const list = byField.get(item.fieldId) ?? [];
    list.push(item);
    byField.set(item.fieldId, list);
  }

  const sections: DocumentSectionView[] = [];
  const sectionByKey = new Map<string, DocumentSectionView>();
  const groupByKey = new Map<string, DocumentGroupView>();

  for (const field of sittingFields(covers)) {
    const loc = fieldLocation.get(field.id);
    if (!loc) continue;

    let section = sectionByKey.get(loc.sectionId);
    if (!section) {
      section = { id: loc.sectionId, title: loc.sectionTitle, groups: [] };
      sectionByKey.set(loc.sectionId, section);
      sections.push(section);
    }

    const groupKey = `${loc.sectionId}::${loc.groupTitle ?? ""}`;
    let group = groupByKey.get(groupKey);
    if (!group) {
      group = { title: loc.groupTitle, fields: [] };
      groupByKey.set(groupKey, group);
      section.groups.push(group);
    }

    const items = byField.get(field.id) ?? [];
    group.fields.push({
      id: field.id,
      label: field.label,
      type: field.type,
      entityType: entityTypeFor(field.id) ?? null,
      attributeKeys: attributeKeysFor(field.id),
      sealed: field.disclosure === "sealed",
      // An entity or an amount is named beside its own detail; a plain field
      // or a gap already repeats its own label as the <dt>, so leave it off
      // the entry rather than saying the same thing twice.
      entries: items.map((item) => ({
        kind: item.kind as "field" | "entity" | "amount" | "gap",
        entityId: item.entityId,
        label: item.kind === "entity" || item.kind === "amount" ? item.label : "",
        text: item.text,
        detail: item.detail,
        attributes: item.attributes,
      })),
    });
  }

  return sections;
}

/** Notes don't belong to a field, so they sit outside the outline proper. */
export function looseNotes(captured: CapturedItem[]): DocumentEntry[] {
  return captured
    .filter((item) => item.kind === "note")
    .map((item) => ({
      kind: "note" as const,
      entityId: null,
      label: item.label,
      text: item.text,
      detail: item.detail,
      attributes: null,
    }));
}
