import { TaskStatus } from '@ethics/shared';
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

export function useTaskListTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));
  const cursor = searchParams.get('cursor') ?? undefined;

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

  const listQuery = useMemo((): ListTasksQuery => {
    const isCompletedTab = activeTab === 'completed';
    return {
      status: [...TAB_STATUS_MAP[activeTab]],
      limit: 20,
      cursor,
      sortBy: isCompletedTab ? 'createdAt' : 'dueAt',
      sortOrder: isCompletedTab ? 'desc' : 'asc',
    };
  }, [activeTab, cursor]);

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
    listQuery,
    pendingCountQuery,
    setActiveTab,
    setCursor,
  };
}
