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
} as const;
