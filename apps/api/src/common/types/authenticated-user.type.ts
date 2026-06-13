import type { ClearanceLevel, Role } from '@ethics/shared';

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  clearanceLevel: ClearanceLevel;
  companyId: string | null;
  companyName: string | null;
  isGeneralSecretary: boolean;
};

export type SessionUserPayload = {
  userId: string;
};
