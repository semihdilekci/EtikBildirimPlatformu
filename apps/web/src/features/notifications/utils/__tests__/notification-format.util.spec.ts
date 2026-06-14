import { describe, expect, it } from 'vitest';

import {
  formatNotificationRelativeTime,
  getNotificationTargetPath,
} from '@/features/notifications/utils/notification-format.util';

describe('formatNotificationRelativeTime', () => {
  it('should format recent notifications in Turkish relative time', () => {
    const now = new Date('2026-06-14T12:00:00.000Z').getTime();
    const twoHoursAgo = '2026-06-14T10:00:00.000Z';

    expect(formatNotificationRelativeTime(twoHoursAgo, now)).toMatch(/2 saat önce/);
  });
});

describe('getNotificationTargetPath', () => {
  it('should prefer task detail when taskId is present', () => {
    expect(
      getNotificationTargetPath({
        id: 'n1',
        templateCode: 'task_assigned',
        title: 'Görev',
        body: 'Yeni görev',
        caseId: 'case-1',
        taskId: 'task-1',
        isRead: false,
        createdAt: '2026-06-14T10:00:00.000Z',
      }),
    ).toBe('/app/tasks/task-1');
  });

  it('should navigate to case detail when only caseId is present', () => {
    expect(
      getNotificationTargetPath({
        id: 'n2',
        templateCode: 'case_transition',
        title: 'Vaka',
        body: 'Durum değişti',
        caseId: 'case-2',
        taskId: null,
        isRead: true,
        createdAt: '2026-06-14T10:00:00.000Z',
      }),
    ).toBe('/app/cases/case-2');
  });

  it('should return null when no navigation target exists', () => {
    expect(
      getNotificationTargetPath({
        id: 'n3',
        templateCode: 'system_notice',
        title: 'Sistem',
        body: 'Bilgi',
        caseId: null,
        taskId: null,
        isRead: false,
        createdAt: '2026-06-14T10:00:00.000Z',
      }),
    ).toBeNull();
  });
});
