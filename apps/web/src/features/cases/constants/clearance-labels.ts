import { ClearanceLevel, type ClearanceLevelCode } from '@ethics/shared';

export const CLEARANCE_LEVEL_LABELS: Readonly<Record<ClearanceLevelCode, string>> = {
  [ClearanceLevel.NORMAL]: 'Normal',
  [ClearanceLevel.SENSITIVE]: 'Hassas',
  [ClearanceLevel.STRICTLY_CONFIDENTIAL]: 'Çok Gizli',
};

export function getClearanceLabel(level: ClearanceLevelCode): string {
  return CLEARANCE_LEVEL_LABELS[level];
}
