import {
  ClearanceLevel,
  type ClearanceLevel as ClearanceLevelCode,
} from '../enums/clearance-level.enum.js';

const CLEARANCE_RANK: Record<ClearanceLevelCode, number> = {
  [ClearanceLevel.NORMAL]: 1,
  [ClearanceLevel.SENSITIVE]: 2,
  [ClearanceLevel.STRICTLY_CONFIDENTIAL]: 3,
};

export function getClearanceRank(level: ClearanceLevelCode): number {
  return CLEARANCE_RANK[level];
}

export function isClearanceUpgrade(
  currentLevel: ClearanceLevelCode,
  targetLevel: ClearanceLevelCode,
): boolean {
  return getClearanceRank(targetLevel) > getClearanceRank(currentLevel);
}

export function requiresStrictlyConfidentialMakerChecker(
  currentLevel: ClearanceLevelCode,
  targetLevel: ClearanceLevelCode,
): boolean {
  return (
    targetLevel === ClearanceLevel.STRICTLY_CONFIDENTIAL &&
    isClearanceUpgrade(currentLevel, targetLevel)
  );
}
