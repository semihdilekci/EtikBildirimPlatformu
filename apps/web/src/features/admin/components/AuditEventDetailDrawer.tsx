import CloseIcon from '@mui/icons-material/Close';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { Box, Chip, Divider, Drawer, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { AdminAuditEventItem } from '@ethics/dto';

import {
  AuditMetadataJsonViewer,
  AuditMetadataViewer,
} from '@/features/admin/components/AuditMetadataViewer';
import { getAuditEventTypeLabel } from '@/features/admin/constants/audit-event-labels';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';

type AuditEventDetailDrawerProps = {
  event: AdminAuditEventItem | null;
  open: boolean;
  onClose: () => void;
  onCopyCorrelationId: (correlationId: string) => void;
};

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box sx={{ py: 0.75 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

function outcomeColor(outcome: string): 'success' | 'error' | 'default' {
  if (outcome === 'SUCCESS') {
    return 'success';
  }
  if (outcome === 'DENIED' || outcome === 'FAILED') {
    return 'error';
  }
  return 'default';
}

export function AuditEventDetailDrawer({
  event,
  open,
  onClose,
  onCopyCorrelationId,
}: AuditEventDetailDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 } } } }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5 }}
        >
          <Typography variant="h6" component="h2">
            Denetim Kaydı Detayı
          </Typography>
          <IconButton onClick={onClose} aria-label="Detayı kapat">
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider />

        {!event ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Kayıt seçilmedi.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  label={getAuditEventTypeLabel(event.eventType)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Chip label={event.outcome} size="small" color={outcomeColor(event.outcome)} />
                <Chip label={event.severity} size="small" variant="outlined" />
              </Stack>

              <DetailField label="Olay Tipi" value={event.eventType} />
              <DetailField label="Zaman" value={formatCaseDateTime(event.occurredAt)} />
              <DetailField label="Kayıt Zamanı" value={formatCaseDateTime(event.recordedAt)} />
              <DetailField label="Kategori" value={event.eventCategory} />
              <DetailField label="Aktör Tipi" value={event.actorType} />
              <DetailField label="Aktör ID" value={event.actorId} />
              <DetailField label="Aksiyon" value={event.action} />
              <DetailField label="Kaynak Tipi" value={event.resourceType} />
              <DetailField label="Kaynak ID" value={event.resourceId} />

              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Correlation ID
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    sx={{ wordBreak: 'break-all' }}
                  >
                    {event.correlationId ?? '—'}
                  </Typography>
                  {event.correlationId ? (
                    <Tooltip title="Kopyala">
                      <IconButton
                        size="small"
                        aria-label="Correlation ID kopyala"
                        onClick={() => {
                          const correlationId = event.correlationId;
                          if (correlationId) {
                            onCopyCorrelationId(correlationId);
                          }
                        }}
                      >
                        <ContentCopyOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>
              </Box>

              <Divider />

              <AuditMetadataViewer metadata={event.metadata} />

              <AuditMetadataJsonViewer metadata={event.metadata} />
            </Stack>
          </Box>
        )}
      </Stack>
    </Drawer>
  );
}
