import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { Alert, Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import type { CaseTransitionItem } from '@ethics/dto';

import { CaseStateBadge } from '@/features/cases/components/CaseStateBadge';
import { formatCaseDateTime } from '@/features/cases/utils/case-format.util';
import type { CaseStateCode } from '@ethics/shared';

type CaseTimelineProps = {
  transitions: CaseTransitionItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export function CaseTimeline({ transitions, isLoading, isError, onRetry }: CaseTimelineProps) {
  if (isLoading) {
    return (
      <Stack spacing={2}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={88} />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert
        severity="error"
        action={
          <Typography
            component="button"
            variant="body2"
            onClick={onRetry}
            sx={{ border: 0, background: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Tekrar Dene
          </Typography>
        }
      >
        Zaman çizelgesi yüklenemedi.
      </Alert>
    );
  }

  if (!transitions || transitions.length === 0) {
    return (
      <Alert severity="info" role="status">
        Henüz durum geçişi kaydı bulunmuyor.
      </Alert>
    );
  }

  return (
    <Stack spacing={2} component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {transitions.map((transition) => (
        <Box component="li" key={transition.id}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="caption" color="text.secondary">
                  {formatCaseDateTime(transition.transitionedAt)}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <CaseStateBadge
                    state={transition.fromState as CaseStateCode}
                    label={transition.fromStateLabel}
                  />
                  <ArrowForwardOutlinedIcon fontSize="small" aria-hidden />
                  <CaseStateBadge
                    state={transition.toState as CaseStateCode}
                    label={transition.toStateLabel}
                  />
                </Stack>

                <Typography variant="body2">
                  <strong>{transition.commandLabel}</strong>
                  {transition.actorDisplayName ? ` — ${transition.actorDisplayName}` : null}
                </Typography>

                {transition.reason ? (
                  <Typography variant="body2" color="text.secondary">
                    Gerekçe: {transition.reason}
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      ))}
    </Stack>
  );
}
