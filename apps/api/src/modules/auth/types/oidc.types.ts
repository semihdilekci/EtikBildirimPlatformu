export type OidcProfileClaims = {
  sub: string;
  email: string;
  name?: string;
};

export type ProvisionedUser = {
  id: string;
  email: string;
  displayName: string;
  clearanceLevel: string;
  companyId: string | null;
  isGeneralSecretary: boolean;
  company: { name: string } | null;
  rolesAssigned: Array<{ roleCode: string }>;
  jitProvisioned: boolean;
};
