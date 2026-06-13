/** Internal user roles — Faz 2'de policy paketine genişletilir */
export const Role = {
  COUNCIL_SECRETARY: 'council_secretary',
  COUNCIL_CHAIR: 'council_chair',
  COUNCIL_MEMBER: 'council_member',
  RAPPORTEUR: 'rapporteur',
  BOARD_CHAIR: 'board_chair',
  ACTION_OWNER: 'action_owner',
  ADMIN: 'admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_VALUES = Object.values(Role) as readonly Role[];
