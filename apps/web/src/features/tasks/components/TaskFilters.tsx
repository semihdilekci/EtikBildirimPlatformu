import {
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { WORK_ITEM_KIND_VALUES, type WorkItemKindCode } from '@ethics/shared';

import { getWorkItemKindLabel } from '@/features/tasks/utils/approval-format.util';

type TaskFiltersProps = {
  kind: WorkItemKindCode | '';
  onKindChange: (kind: WorkItemKindCode | '') => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function TaskFilters({
  kind,
  onKindChange,
  onClearFilters,
  hasActiveFilters,
}: TaskFiltersProps) {
  const handleKindChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    onKindChange(value === '' ? '' : (value as WorkItemKindCode));
  };

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="task-filter-kind-label">Tür</InputLabel>
          <Select
            labelId="task-filter-kind-label"
            value={kind}
            label="Tür"
            onChange={handleKindChange}
          >
            <MenuItem value="">Tümü</MenuItem>
            {WORK_ITEM_KIND_VALUES.map((itemKind) => (
              <MenuItem key={itemKind} value={itemKind}>
                {getWorkItemKindLabel(itemKind)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {hasActiveFilters ? (
          <Link component="button" type="button" onClick={onClearFilters} underline="hover">
            Filtreleri Temizle
          </Link>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Filtreler URL ile senkronize edilir.
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
