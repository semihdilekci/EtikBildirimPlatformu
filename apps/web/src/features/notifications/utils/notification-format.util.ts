import type { NotificationListItem } from '@ethics/dto';

const RELATIVE_TIME_DIVISIONS: readonly { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

export function formatNotificationRelativeTime(isoDate: string, now = Date.now()): string {
  let deltaSeconds = Math.round((new Date(isoDate).getTime() - now) / 1000);
  let divisionIndex = 0;

  while (divisionIndex < RELATIVE_TIME_DIVISIONS.length - 1) {
    const division = RELATIVE_TIME_DIVISIONS[divisionIndex];
    if (!division || Math.abs(deltaSeconds) < division.amount) {
      break;
    }

    deltaSeconds = Math.round(deltaSeconds / division.amount);
    divisionIndex += 1;
  }

  const currentDivision = RELATIVE_TIME_DIVISIONS[divisionIndex] ?? RELATIVE_TIME_DIVISIONS.at(-1);
  if (!currentDivision) {
    return relativeTimeFormatter.format(deltaSeconds, 'second');
  }

  return relativeTimeFormatter.format(deltaSeconds, currentDivision.unit);
}

export function getNotificationTargetPath(notification: NotificationListItem): string | null {
  if (notification.taskId) {
    return `/app/tasks/${notification.taskId}`;
  }

  if (notification.caseId) {
    return `/app/cases/${notification.caseId}`;
  }

  return null;
}
