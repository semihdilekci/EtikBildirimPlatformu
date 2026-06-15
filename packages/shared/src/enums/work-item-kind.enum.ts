/** Birleşik görev kuyruğu discriminator — Docs/03 §8.5 */
export const WorkItemKind = {
  WORKFLOW: 'WORKFLOW',
  APPROVAL: 'APPROVAL',
} as const;

export type WorkItemKindCode = (typeof WorkItemKind)[keyof typeof WorkItemKind];

export const WORK_ITEM_KIND_VALUES = Object.values(WorkItemKind) as readonly WorkItemKindCode[];
