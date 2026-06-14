/** SLA reminder cron — Docs/04 §sla_reminder, Faz 8 iterasyon 5 */
export const SLA_REMINDER_CRON_INTERVAL_MS = 5 * 60 * 1000;

/** Sessiz kabul cron — Docs/04 §silent_acceptance */
export const SILENT_ACCEPTANCE_CRON_INTERVAL_MS = 5 * 60 * 1000;

/** Audit chain verify — günlük (Faz 8 iterasyon 5) */
export const AUDIT_CHAIN_VERIFY_CRON_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** In-app notification retention purge — günlük */
export const RETENTION_PURGE_CRON_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Okunmuş in-app bildirimler için varsayılan saklama süresi (gün) */
export const IN_APP_NOTIFICATION_RETENTION_DAYS = 90;
