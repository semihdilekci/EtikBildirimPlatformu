import type { ClearanceLevel } from '@ethics/shared';

/**
 * Case/Task Prisma modelleri Faz 5'te eklenecek.
 * PolicyScope bu tipleri üretir; Faz 5'te `Prisma.CaseWhereInput` ile hizalanır.
 */
export type ClearanceLevelFilter = {
  in: readonly ClearanceLevel[];
};

export type CaseWhereInput = {
  id?: string;
  AND?: CaseWhereInput[];
  OR?: CaseWhereInput[];
  assignedRapporteurId?: string;
  assignedActionOwnerId?: string;
  companyId?: string;
  confidentialityLevel?: ClearanceLevelFilter;
};

export type TaskWhereInput = {
  id?: string;
  AND?: TaskWhereInput[];
  OR?: TaskWhereInput[];
  assignedUserId?: string;
  assignedCompanyId?: string;
  assignedFunctionId?: string;
  case?: {
    confidentialityLevel?: ClearanceLevelFilter;
    companyId?: string;
  };
};
