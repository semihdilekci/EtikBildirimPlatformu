export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  intake: {
    categories: () => ['intake', 'categories'] as const,
    companies: () => ['intake', 'companies'] as const,
    kvkkText: () => ['intake', 'kvkkText'] as const,
  },
  tracking: {
    status: () => ['tracking', 'status'] as const,
    messages: () => ['tracking', 'messages'] as const,
  },
  cases: {
    all: () => ['cases'] as const,
    list: (filters: unknown) => ['cases', 'list', filters] as const,
    detail: (caseId: string) => ['cases', 'detail', caseId] as const,
    transitions: (caseId: string) => ['cases', 'transitions', caseId] as const,
    documents: (caseId: string) => ['cases', 'documents', caseId] as const,
  },
  tasks: {
    all: () => ['tasks'] as const,
    list: (filters: unknown) => ['tasks', 'list', filters] as const,
    detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
  },
  notifications: {
    all: () => ['notifications'] as const,
    list: (filters: unknown) => ['notifications', 'list', filters] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },
  admin: {
    users: {
      all: () => ['admin', 'users'] as const,
      list: (filters: unknown) => ['admin', 'users', 'list', filters] as const,
      detail: (userId: string) => ['admin', 'users', 'detail', userId] as const,
    },
    systemSettings: () => ['admin', 'systemSettings'] as const,
    fieldVisibility: () => ['admin', 'fieldVisibility'] as const,
    actionMatrix: () => ['admin', 'actionMatrix'] as const,
    slaPolicies: () => ['admin', 'slaPolicies'] as const,
    businessCalendar: (query: unknown) => ['admin', 'businessCalendar', query] as const,
    notificationTemplates: () => ['admin', 'notificationTemplates'] as const,
    kvkkTexts: () => ['admin', 'kvkkTexts'] as const,
    auditEvents: (filters: unknown) => ['admin', 'auditEvents', filters] as const,
    auditExportJob: (jobId: string) => ['admin', 'auditExportJob', jobId] as const,
    documentOperations: (filters: unknown) => ['admin', 'documentOperations', filters] as const,
    systemHealth: () => ['admin', 'systemHealth'] as const,
    masterDataSyncRuns: () => ['admin', 'masterData', 'syncRuns'] as const,
    masterDataList: (type: string) => ['admin', 'masterData', 'list', type] as const,
  },
} as const;
