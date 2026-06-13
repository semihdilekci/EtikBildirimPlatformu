import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { CaseDetail } from '@ethics/dto';

import { formatCaseDate } from '@/features/cases/utils/case-format.util';

type CaseSummaryTabProps = {
  caseDetail: CaseDetail;
};

export function CaseSummaryTab({ caseDetail }: CaseSummaryTabProps) {
  return (
    <Stack spacing={2}>
      {caseDetail.urgentRiskFlag ? (
        <Alert severity="warning" icon={<WarningAmberOutlinedIcon aria-hidden />}>
          Bu bildirim acil risk bayrağı ile işaretlenmiştir.
        </Alert>
      ) : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" fontWeight={600}>
              Bildirim Özeti
            </Typography>
            {caseDetail.incidentDescription ? (
              <Typography variant="body2" whiteSpace="pre-wrap">
                {caseDetail.incidentDescription}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Bildirim içeriği görüntülenemiyor.
              </Typography>
            )}
            {caseDetail.incidentDateStart ? (
              <Typography variant="body2" color="text.secondary">
                Olay tarihi: {formatCaseDate(caseDetail.incidentDateStart)}
              </Typography>
            ) : null}
            {caseDetail.categories.length > 0 ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {caseDetail.categories.map((category) => (
                  <Chip key={category} label={category} size="small" variant="outlined" />
                ))}
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {caseDetail.involvedPersons !== undefined ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              İlgili Kişiler
            </Typography>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
              {JSON.stringify(caseDetail.involvedPersons, null, 2)}
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      {caseDetail.witnesses !== undefined ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Tanıklar
            </Typography>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
              {JSON.stringify(caseDetail.witnesses, null, 2)}
            </Typography>
          </CardContent>
        </Card>
      ) : null}

      {caseDetail.reporterIdentityName !== undefined ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Bildirimci Bilgisi
            </Typography>
            <Typography variant="body2">
              {caseDetail.reporterIdentityName ?? 'Anonim bildirim'}
            </Typography>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
