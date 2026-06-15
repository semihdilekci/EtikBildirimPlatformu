import { TaskStatus, WORK_ITEM_KIND_VALUES, type WorkItemKindCode } from '@ethics/shared';
import type { ListTasksQuery } from '@ethics/dto';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type TaskListTab = 'pending' | 'in_progress' | 'completed';

const TAB_VALUES: readonly TaskListTab[] = ['pending', 'in_progress', 'completed'] as const;

const TAB_STATUS_MAP: Record<TaskListTab, readonly string[]> = {
  pending: [TaskStatus.PENDING],
  in_progress: [TaskStatus.IN_PROGRESS],
  completed: [TaskStatus.COMPLETED],
};

const TAB_LABELS: Record<TaskListTab, string> = {
  pending: 'Bekleyen',
  in_progress: 'Devam Eden',
  completed: 'Tamamlanan',
};

function parseTab(value: string | null): TaskListTab {
  if (value && TAB_VALUES.includes(value as TaskListTab)) {
    return value as TaskListTab;
  }
  return 'pending';
}

function parseKind(value: string | null): WorkItemKindCode | '' {
  if (value && WORK_ITEM_KIND_VALUES.includes(value as WorkItemKindCode)) {
    return value as WorkItemKindCode;
  }
  return '';
}

export function useTaskListTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));
  const cursor = searchParams.get('cursor') ?? undefined;
  const kind = parseKind(searchParams.get('kind'));

  const setActiveTab = useCallback(
    (tab: TaskListTab) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('tab', tab);
        next.delete('cursor');
        return next;
      });
    },
    [setSearchParams],
  );

  const setCursor = useCallback(
    (nextCursor: string | null) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (nextCursor) {
          next.set('cursor', nextCursor);
        } else {
          next.delete('cursor');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const setKind = useCallback(
    (nextKind: WorkItemKindCode | '') => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (nextKind) {
          next.set('kind', nextKind);
        } else {
          next.delete('kind');
        }
        next.delete('cursor');
        return next;
      });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('kind');
      next.delete('cursor');
      return next;
    });
  }, [setSearchParams]);

  const listQuery = useMemo((): ListTasksQuery => {
    const isCompletedTab = activeTab === 'completed';
    return {
      status: [...TAB_STATUS_MAP[activeTab]],
      ...(kind ? { kind } : {}),
      limit: 20,
      cursor,
      sortBy: isCompletedTab ? 'createdAt' : 'dueAt',
      sortOrder: isCompletedTab ? 'desc' : 'asc',
    };
  }, [activeTab, cursor, kind]);

  const pendingCountQuery = useMemo(
    (): ListTasksQuery => ({
      status: [TaskStatus.PENDING],
      limit: 100,
      sortBy: 'dueAt',
      sortOrder: 'asc',
    }),
    [],
  );

  return {
    activeTab,
    tabLabels: TAB_LABELS,
    kind,
    listQuery,
    pendingCountQuery,
    setActiveTab,
    setCursor,
    setKind,
    clearFilters,
    hasActiveFilters: kind !== '',
  };
}
