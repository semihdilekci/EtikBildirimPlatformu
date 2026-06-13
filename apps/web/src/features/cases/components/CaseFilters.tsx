import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import { isClearanceSufficient } from '@ethics/policy';
import {
  CASE_STATE_VALUES,
  CLEARANCE_LEVEL_VALUES,
  getCaseStateLabel,
  type CaseStateCode,
  type ClearanceLevelCode,
} from '@ethics/shared';

import { getClearanceLabel } from '@/features/cases/constants/clearance-labels';

type CaseFiltersProps = {
  status: string[];
  companyId: string;
  confidentialityLevel: string;
  dateFrom: string;
  dateTo: string;
  assignedToMe: boolean;
  companies: Array<{ id: string; name: string }>;
  userClearance: ClearanceLevelCode;
  onStatusChange: (statuses: string[]) => void;
  onCompanyChange: (companyId: string) => void;
  onConfidentialityChange: (level: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onAssignedToMeChange: (assigned: boolean) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function CaseFilters({
  status,
  companyId,
  confidentialityLevel,
  dateFrom,
  dateTo,
  assignedToMe,
  companies,
  userClearance,
  onStatusChange,
  onCompanyChange,
  onConfidentialityChange,
  onDateFromChange,
  onDateToChange,
  onAssignedToMeChange,
  onClearFilters,
  hasActiveFilters,
}: CaseFiltersProps) {
  const allowedClearanceLevels = CLEARANCE_LEVEL_VALUES.filter((level) =>
    isClearanceSufficient(userClearance, level),
  );

  const handleStatusChange = (event: SelectChangeEvent<string[]>) => {
    onStatusChange(event.target.value as string[]);
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        useFlexGap
        flexWrap="wrap"
        alignItems={{ md: 'center' }}
      >
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="case-filter-status-label">Durum</InputLabel>
          <Select
            labelId="case-filter-status-label"
            multiple
            value={status}
            label="Durum"
            onChange={handleStatusChange}
            renderValue={(selected) =>
              (selected as CaseStateCode[]).map((item) => getCaseStateLabel(item)).join(', ')
            }
          >
            {CASE_STATE_VALUES.map((state) => (
              <MenuItem key={state} value={state}>
                {getCaseStateLabel(state)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="case-filter-company-label">Şirket</InputLabel>
          <Select
            labelId="case-filter-company-label"
            value={companyId}
            label="Şirket"
            onChange={(event) => {
              onCompanyChange(event.target.value);
            }}
          >
            <MenuItem value="">Tümü</MenuItem>
            {companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="case-filter-clearance-label">Gizlilik</InputLabel>
          <Select
            labelId="case-filter-clearance-label"
            value={confidentialityLevel}
            label="Gizlilik"
            onChange={(event) => {
              onConfidentialityChange(event.target.value);
            }}
          >
            <MenuItem value="">Tümü</MenuItem>
            {allowedClearanceLevels.map((level) => (
              <MenuItem key={level} value={level}>
                {getClearanceLabel(level)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Başlangıç"
          type="date"
          size="small"
          value={dateFrom}
          onChange={(event) => {
            onDateFromChange(event.target.value);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: { xs: '100%', sm: 170 } }}
        />

        <TextField
          label="Bitiş"
          type="date"
          size="small"
          value={dateTo}
          onChange={(event) => {
            onDateToChange(event.target.value);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: { xs: '100%', sm: 170 } }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={assignedToMe}
              onChange={(event) => {
                onAssignedToMeChange(event.target.checked);
              }}
              slotProps={{ input: { 'aria-label': 'Bana atanan vakalar' } }}
            />
          }
          label="Bana Atananlar"
        />
      </Stack>

      {hasActiveFilters ? (
        <Box>
          <Link component="button" type="button" onClick={onClearFilters} underline="hover">
            Filtreleri Temizle
          </Link>
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary">
          Filtreler URL ile senkronize edilir.
        </Typography>
      )}
    </Stack>
  );
}
