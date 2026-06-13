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
  },
  tasks: {
    all: () => ['tasks'] as const,
    list: (filters: unknown) => ['tasks', 'list', filters] as const,
    detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
  },
} as const;
