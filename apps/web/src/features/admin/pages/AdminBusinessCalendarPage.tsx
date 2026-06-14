import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid2 as Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { BusinessCalendarEntryDto } from '@ethics/dto';
import type { BusinessCalendarDayTypeCode } from '@ethics/shared';
import { useMemo, useState } from 'react';

import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminReasonDialog } from '@/features/admin/components/AdminReasonDialog';
import {
  AdminToastSnackbar,
  type AdminToastSeverity,
} from '@/features/admin/components/AdminToastSnackbar';
import {
  ADDABLE_BUSINESS_CALENDAR_DAY_TYPES,
  getBusinessCalendarDayColor,
  getBusinessCalendarDayTypeLabel,
} from '@/features/admin/constants/business-calendar-labels';
import {
  useBusinessCalendarQuery,
  useCreateBusinessCalendarEntryMutation,
  useDeleteBusinessCalendarEntryMutation,
} from '@/features/admin/hooks/useAdminSla';
import { getAdminErrorMessage } from '@/features/admin/utils/admin-error.util';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

type ToastSeverity = AdminToastSeverity;

function getMonthRange(referenceDate: Date): { from: string; to: string } {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const format = (date: Date) =>
    `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: format(from), to: format(to) };
}

export function AdminBusinessCalendarPage() {
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const monthRange = useMemo(() => getMonthRange(referenceDate), [referenceDate]);
  const calendarQuery = useBusinessCalendarQuery(monthRange);
  const createMutation = useCreateBusinessCalendarEntryMutation();
  const deleteMutation = useDeleteBusinessCalendarEntryMutation();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusinessCalendarEntryDto | null>(null);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [reasonMode, setReasonMode] = useState<'create' | 'delete'>('create');
  const [draft, setDraft] = useState({
    date: '',
    dayType: 'COMPANY_HOLIDAY' as BusinessCalendarDayTypeCode,
    description: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastSeverity, setToastSeverity] = useState<ToastSeverity>('success');

  const entriesByDate = useMemo(() => {
    const map = new Map<string, BusinessCalendarEntryDto>();
    for (const entry of calendarQuery.data ?? []) {
      map.set(entry.date, entry);
    }
    return map;
  }, [calendarQuery.data]);

  const monthDays = useMemo(() => {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${String(year)}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { day, date };
    });
  }, [referenceDate]);

  const showToast = (message: string, severity: ToastSeverity) => {
    setToastMessage(message);
    setToastSeverity(severity);
  };

  const handleReasonConfirm = async (reason: string) => {
    try {
      if (reasonMode === 'create') {
        await createMutation.mutateAsync({
          date: draft.date,
          dayType: draft.dayType,
          description: draft.description || undefined,
          reason,
        });
        setShowAddDialog(false);
        showToast('Tatil/özel gün eklendi.', 'success');
      } else if (deleteTarget) {
        await deleteMutation.mutateAsync({ entryId: deleteTarget.id, body: { reason } });
        setDeleteTarget(null);
        showToast('Kayıt silindi.', 'success');
      }
      setShowReasonDialog(false);
    } catch (error) {
      showToast(getAdminErrorMessage(error), 'error');
    }
  };

  if (calendarQuery.isLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={280} height={40} />
        <Skeleton variant="rounded" height={360} />
      </Stack>
    );
  }

  if (calendarQuery.isError) {
    return (
      <Stack spacing={2}>
        <AdminPageHeader
          title="İş Günü Takvimi"
          description="SLA iş günü hesabı için tatil ve özel günleri yönetin."
        />
        <Alert severity="error">{getAdminErrorMessage(calendarQuery.error)}</Alert>
        <Button onClick={() => void calendarQuery.refetch()}>Tekrar Dene</Button>
      </Stack>
    );
  }

  const monthLabel = referenceDate.toLocaleDateString('tr-TR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Stack spacing={3}>
      <AdminPageHeader
        title="İş Günü Takvimi"
        description="SLA iş günü hesabı için tatil ve özel günleri yönetin."
      />

      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={() => {
              setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
            }}
          >
            Önceki Ay
          </Button>
          <Typography variant="h6" sx={{ px: 1, alignSelf: 'center' }}>
            {monthLabel}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setReferenceDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
            }}
          >
            Sonraki Ay
          </Button>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          onClick={() => {
            setDraft({
              date: monthRange.from,
              dayType: 'COMPANY_HOLIDAY',
              description: '',
            });
            setShowAddDialog(true);
          }}
        >
          Tatil/Özel Gün Ekle
        </Button>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Grid container spacing={1}>
          {monthDays.map(({ day, date }) => {
            const entry = entriesByDate.get(date);
            return (
              <Grid key={date} size={{ xs: 4, sm: 3, md: 2, lg: 1.7 }}>
                <Box
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1,
                    minHeight: 72,
                    bgcolor: entry
                      ? getBusinessCalendarDayColor(entry.dayType as BusinessCalendarDayTypeCode)
                      : 'background.paper',
                  }}
                >
                  <Typography variant="subtitle2">{day}</Typography>
                  {entry ? (
                    <Typography variant="caption" display="block">
                      {getBusinessCalendarDayTypeLabel(
                        entry.dayType as BusinessCalendarDayTypeCode,
                      )}
                    </Typography>
                  ) : null}
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small" aria-label="Tatil listesi">
          <TableHead>
            <TableRow>
              <TableCell scope="col">Tarih</TableCell>
              <TableCell scope="col">Tip</TableCell>
              <TableCell scope="col">Açıklama</TableCell>
              <TableCell scope="col">Güncelleme</TableCell>
              <TableCell scope="col" align="right">
                İşlem
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(calendarQuery.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography variant="body2" color="text.secondary">
                    Bu ay için kayıt yok.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              (calendarQuery.data ?? []).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell>
                    {getBusinessCalendarDayTypeLabel(entry.dayType as BusinessCalendarDayTypeCode)}
                  </TableCell>
                  <TableCell>{entry.description ?? '—'}</TableCell>
                  <TableCell>{formatCaseDateTime(entry.updatedAt)}</TableCell>
                  <TableCell align="right">
                    <Button
                      color="error"
                      size="small"
                      startIcon={<DeleteOutlineOutlinedIcon />}
                      onClick={() => {
                        setDeleteTarget(entry);
                        setReasonMode('delete');
                        setShowReasonDialog(true);
                      }}
                    >
                      Sil
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={showAddDialog}
        onClose={() => {
          if (!createMutation.isPending) {
            setShowAddDialog(false);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Tatil/Özel Gün Ekle</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Tarih"
            type="date"
            value={draft.date}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, date: event.target.value }));
            }}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="day-type-label">Tip</InputLabel>
            <Select
              labelId="day-type-label"
              label="Tip"
              value={draft.dayType}
              onChange={(event) => {
                setDraft((prev) => ({
                  ...prev,
                  dayType: event.target.value as BusinessCalendarDayTypeCode,
                }));
              }}
            >
              {ADDABLE_BUSINESS_CALENDAR_DAY_TYPES.map((dayType) => (
                <MenuItem key={dayType} value={dayType}>
                  {getBusinessCalendarDayTypeLabel(dayType)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Açıklama"
            value={draft.description}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, description: event.target.value }));
            }}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowAddDialog(false);
            }}
            disabled={createMutation.isPending}
          >
            İptal
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setReasonMode('create');
              setShowReasonDialog(true);
            }}
            disabled={createMutation.isPending || !draft.date}
          >
            Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      <AdminReasonDialog
        open={showReasonDialog}
        title={reasonMode === 'create' ? 'Ekleme Gerekçesi' : 'Silme Gerekçesi'}
        isSubmitting={createMutation.isPending || deleteMutation.isPending}
        onClose={() => {
          setShowReasonDialog(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleReasonConfirm}
      />

      <AdminToastSnackbar
        message={toastMessage}
        severity={toastSeverity}
        onClose={() => {
          setToastMessage(null);
        }}
      />
    </Stack>
  );
}
