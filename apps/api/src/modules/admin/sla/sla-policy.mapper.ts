import type { SlaPolicyConfigSnapshot } from '@ethics/dto';
import { SlaUnit } from '@ethics/shared';
import type { SlaPolicyConfig } from '@prisma/client';

export function toSlaPolicyConfigSnapshot(policy: SlaPolicyConfig): SlaPolicyConfigSnapshot {
  return {
    slaDuration: policy.slaDuration,
    slaUnit: policy.slaUnit,
    warningThresholdHours: policy.warningThresholdHours,
    dailyOverdueNotification: policy.dailyOverdueNotification,
    escalationRole: policy.escalationRole,
  };
}

export function validateSlaPolicySnapshot(snapshot: SlaPolicyConfigSnapshot): string | null {
  if (snapshot.slaUnit === SlaUnit.BUSINESS_DAYS && snapshot.slaDuration > 365) {
    return 'İş günü SLA süresi en fazla 365 olabilir.';
  }

  if (snapshot.slaUnit === SlaUnit.CALENDAR_HOURS && snapshot.slaDuration > 8760) {
    return 'Takvim saati SLA süresi en fazla 8760 olabilir.';
  }

  if (
    snapshot.warningThresholdHours >= snapshot.slaDuration * 24 &&
    snapshot.slaUnit === SlaUnit.BUSINESS_DAYS
  ) {
    return 'Uyarı eşiği SLA süresinden küçük olmalıdır.';
  }

  if (
    snapshot.slaUnit === SlaUnit.CALENDAR_HOURS &&
    snapshot.warningThresholdHours >= snapshot.slaDuration
  ) {
    return 'Uyarı eşiği SLA süresinden küçük olmalıdır.';
  }

  return null;
}

export function configsEqual(
  left: SlaPolicyConfigSnapshot,
  right: SlaPolicyConfigSnapshot,
): boolean {
  return (
    left.slaDuration === right.slaDuration &&
    left.slaUnit === right.slaUnit &&
    left.warningThresholdHours === right.warningThresholdHours &&
    left.dailyOverdueNotification === right.dailyOverdueNotification &&
    left.escalationRole === right.escalationRole
  );
}
