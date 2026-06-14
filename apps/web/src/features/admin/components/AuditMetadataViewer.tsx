import { Box, Typography } from '@mui/material';

import { AUDIT_METADATA_FIELD_LABELS } from '@/features/admin/constants/audit-event-labels';

const REDACTED_VALUE = '[REDACTED]';

const SENSITIVE_METADATA_KEYS = new Set([
  'report_text',
  'incident_description',
  'reason_text',
  'content',
  'plaintext',
  'documentContent',
]);

type AuditMetadataViewerProps = {
  metadata: Record<string, unknown> | null;
};

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}

function isRedactedValue(value: unknown): boolean {
  return value === REDACTED_VALUE;
}

function MetadataRow({ label, value }: { label: string; value: unknown }) {
  const displayValue = formatMetadataValue(value);
  const redacted = isRedactedValue(value);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
        gap: 1,
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        component="pre"
        sx={{
          m: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: redacted ? 'inherit' : 'monospace',
          fontSize: '0.8125rem',
          color: redacted ? 'warning.main' : 'text.primary',
          fontStyle: redacted ? 'italic' : 'normal',
        }}
      >
        {displayValue}
      </Typography>
    </Box>
  );
}

function sanitizeMetadataValue(key: string, value: unknown): unknown {
  if (SENSITIVE_METADATA_KEYS.has(key) && value !== REDACTED_VALUE) {
    return REDACTED_VALUE;
  }
  return value;
}

export function AuditMetadataViewer({ metadata }: AuditMetadataViewerProps) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Ek metadata bulunmuyor.
      </Typography>
    );
  }

  const entries = Object.entries(metadata).map(
    ([key, value]) => [key, sanitizeMetadataValue(key, value)] as const,
  );

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Metadata (maskeli)
      </Typography>
      {entries.map(([key, value]) => (
        <MetadataRow key={key} label={AUDIT_METADATA_FIELD_LABELS[key] ?? key} value={value} />
      ))}
    </Box>
  );
}

export function AuditMetadataJsonViewer({ metadata }: AuditMetadataViewerProps) {
  if (!metadata) {
    return null;
  }

  const sanitized = Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (SENSITIVE_METADATA_KEYS.has(key) && value !== REDACTED_VALUE) {
        return [key, REDACTED_VALUE];
      }
      return [key, value];
    }),
  );

  const jsonText = JSON.stringify(sanitized, null, 2);

  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        bgcolor: 'grey.50',
        borderRadius: 1,
        overflow: 'auto',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        maxHeight: 320,
      }}
    >
      {jsonText}
    </Box>
  );
}
