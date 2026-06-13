import { PageHeader } from '@/components/brand';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SendIcon from '@mui/icons-material/Send';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid2 as Grid,
  InputLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { ErrorCode } from '@ethics/shared';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import {
  createIntakeReport,
  initiateReportAttachment,
  uploadToPresignedUrl,
} from '@/features/intake/api/intake.api';
import { CategorySelector } from '@/features/intake/components/CategorySelector';
import { DynamicCategoryFields } from '@/features/intake/components/DynamicCategoryFields';
import { FileUploadZone } from '@/features/intake/components/FileUploadZone';
import { KvkkConsentCheckbox } from '@/features/intake/components/KvkkConsentCheckbox';
import { StepIndicator } from '@/features/intake/components/StepIndicator';
import { TrackingPasswordSection } from '@/features/intake/components/TrackingPasswordSection';
import { COUNTRY_OPTIONS } from '@/features/intake/constants/countries';
import {
  HOW_REPORTER_LEARNED_LABELS,
  INCIDENT_RECURRENCE_LABELS,
  REPORTER_IDENTITY_RELATION_LABELS,
} from '@/features/intake/constants/enum-labels';
import {
  useIntakeCategoriesQuery,
  useIntakeCompaniesQuery,
  useIntakeKvkkTextQuery,
} from '@/features/intake/hooks/useIntakeQueries';
import { useReportFormWizard } from '@/features/intake/hooks/useReportForm';
import {
  mapReportFormToApiBody,
  reportFormDefaultValues,
  reportFormSchema,
  type ReportFormValues,
} from '@/features/intake/schemas/report-form.schema';
import { computeFileSha256 } from '@/features/intake/utils/file-hash.util';
import { ApiError } from '@/types/api.types';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReportFormPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoriesQuery = useIntakeCategoriesQuery();
  const companiesQuery = useIntakeCompaniesQuery();
  const kvkkQuery = useIntakeKvkkTextQuery();

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: reportFormDefaultValues,
    mode: 'onTouched',
  });

  const {
    control,
    formState: { errors },
    handleSubmit,
    setValue,
    watch,
  } = form;

  const wizard = useReportFormWizard(form);
  const isAnonymous = watch('isAnonymous');
  const previouslyReported = watch('previouslyReported');
  const urgentRiskFlag = watch('urgentRiskFlag');

  const {
    fields: involvedFields,
    append: appendInvolved,
    remove: removeInvolved,
  } = useFieldArray({ control, name: 'involvedPersons' });

  const {
    fields: witnessFields,
    append: appendWitness,
    remove: removeWitness,
  } = useFieldArray({ control, name: 'witnesses' });

  const bootstrapFailed = categoriesQuery.isError || companiesQuery.isError || kvkkQuery.isError;

  const isBootstrapping =
    categoriesQuery.isLoading || companiesQuery.isLoading || kvkkQuery.isLoading;

  const handleKvkkVersion = useCallback(
    (version: string) => {
      setValue('kvkkConsentVersion', version, { shouldValidate: false });
    },
    [setValue],
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const skippedSteps = useMemo(
    () => (wizard.dynamicStepSkipped ? [5] : []),
    [wizard.dynamicStepSkipped],
  );

  const submitReport = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const body = mapReportFormToApiBody(values);
      const response = await createIntakeReport(body);

      for (const attachment of wizard.attachments) {
        const contentSha256 = await computeFileSha256(attachment.file);
        const initiated = await initiateReportAttachment(response.trackingCode, {
          originalFilename: attachment.file.name,
          mimeType: attachment.file.type,
          sizeBytes: attachment.file.size,
          contentSha256,
        });
        await uploadToPresignedUrl(initiated.uploadUrl, attachment.file, attachment.file.type);
      }

      void navigate('/report/success', {
        replace: true,
        state: {
          trackingCode: response.trackingCode,
          submittedAt: response.submittedAt,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === ErrorCode.RATE_LIMIT_EXCEEDED) {
          setSubmitError('Çok sayıda bildirim gönderildi, lütfen bekleyin.');
        } else {
          setSubmitError(error.message);
        }
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Bildirim gönderilirken bir hata oluştu.');
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  const renderStepContent = () => {
    switch (wizard.activeStep) {
      case 0:
        return (
          <KvkkConsentCheckbox
            control={control}
            errors={errors}
            bodyHtml={kvkkQuery.data?.bodyHtml}
            version={kvkkQuery.data?.version}
            isLoading={kvkkQuery.isLoading}
            onVersionChange={handleKvkkVersion}
          />
        );

      case 1:
        return (
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Bildirimcinin Konumu
            </Typography>
            <Controller
              name="reporterCountry"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={Boolean(errors.reporterCountry)}>
                  <InputLabel id="reporter-country-label">Ülke</InputLabel>
                  <Select {...field} labelId="reporter-country-label" label="Ülke">
                    {COUNTRY_OPTIONS.map((country) => (
                      <MenuItem key={country.code} value={country.code}>
                        {country.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.reporterCountry ? (
                    <FormHelperText>{errors.reporterCountry.message}</FormHelperText>
                  ) : null}
                </FormControl>
              )}
            />
            <Controller
              name="reporterCity"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Şehir"
                  fullWidth
                  error={Boolean(errors.reporterCity)}
                  helperText={errors.reporterCity?.message}
                />
              )}
            />
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              İlgili Şirket ve Olay Yeri
            </Typography>
            <Controller
              name="companyId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={Boolean(errors.companyId)}>
                  <InputLabel id="company-label">Şirket</InputLabel>
                  <Select {...field} labelId="company-label" label="Şirket">
                    {(companiesQuery.data ?? []).map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.companyId ? (
                    <FormHelperText>{errors.companyId.message}</FormHelperText>
                  ) : null}
                </FormControl>
              )}
            />
            <Controller
              name="incidentCountry"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={Boolean(errors.incidentCountry)}>
                  <InputLabel id="incident-country-label">Olay ülkesi</InputLabel>
                  <Select {...field} labelId="incident-country-label" label="Olay ülkesi">
                    {COUNTRY_OPTIONS.map((country) => (
                      <MenuItem key={country.code} value={country.code}>
                        {country.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <Controller
              name="incidentCity"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Olay şehri"
                  fullWidth
                  error={Boolean(errors.incidentCity)}
                  helperText={errors.incidentCity?.message}
                />
              )}
            />
            <Controller
              name="incidentLocationDetail"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label="Olay yeri detayı (tesis, fabrika, ofis)"
                  fullWidth
                />
              )}
            />
          </Stack>
        );

      case 3:
        return (
          <CategorySelector
            control={control}
            errors={errors}
            catalog={categoriesQuery.data}
            setValue={setValue}
          />
        );

      case 4:
        return (
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Olay Bilgileri
            </Typography>
            <Controller
              name="incidentDescription"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Olay açıklaması"
                  fullWidth
                  multiline
                  minRows={5}
                  error={Boolean(errors.incidentDescription)}
                  helperText={
                    errors.incidentDescription?.message ??
                    'En az 50 karakter. Ne oldu, kimler dahil, ne zaman?'
                  }
                />
              )}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="incidentDateStart"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      label="Olay başlangıç tarihi"
                      type="date"
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="incidentDateEnd"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      label="Olay bitiş tarihi"
                      type="date"
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Controller
              name="incidentIsOngoing"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <Typography variant="subtitle2" gutterBottom>
                    Olay devam ediyor mu?
                  </Typography>
                  <RadioGroup
                    row
                    value={field.value ? 'yes' : 'no'}
                    onChange={(event) => {
                      field.onChange(event.target.value === 'yes');
                    }}
                  >
                    <FormControlLabel value="yes" control={<Radio />} label="Evet" />
                    <FormControlLabel value="no" control={<Radio />} label="Hayır" />
                  </RadioGroup>
                </FormControl>
              )}
            />

            <Controller
              name="incidentRecurrence"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel id="recurrence-label">Tekrar durumu</InputLabel>
                  <Select
                    {...field}
                    value={field.value ?? ''}
                    labelId="recurrence-label"
                    label="Tekrar durumu"
                  >
                    <MenuItem value="">
                      <em>Seçiniz</em>
                    </MenuItem>
                    {Object.entries(INCIDENT_RECURRENCE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            <Controller
              name="howReporterLearned"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel id="learned-label">Olayı nasıl öğrendiniz?</InputLabel>
                  <Select
                    {...field}
                    value={field.value ?? ''}
                    labelId="learned-label"
                    label="Olayı nasıl öğrendiniz?"
                  >
                    <MenuItem value="">
                      <em>Seçiniz</em>
                    </MenuItem>
                    {Object.entries(HOW_REPORTER_LEARNED_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />

            <Divider />
            <Typography variant="subtitle1">İlgili kişiler</Typography>
            {involvedFields.map((item, index) => (
              <Stack
                key={item.id}
                spacing={1}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems="flex-start"
              >
                <Controller
                  name={`involvedPersons.${String(index)}.name` as `involvedPersons.${number}.name`}
                  control={control}
                  render={({ field }) => <TextField {...field} label="Ad/tanım" fullWidth />}
                />
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    removeInvolved(index);
                  }}
                >
                  Kaldır
                </Button>
              </Stack>
            ))}
            <Button
              variant="outlined"
              onClick={() => {
                appendInvolved({ name: '' });
              }}
            >
              Kişi ekle
            </Button>

            <Divider />
            <Typography variant="subtitle1">Tanıklar</Typography>
            {witnessFields.map((item, index) => (
              <Stack key={item.id} spacing={1} direction={{ xs: 'column', sm: 'row' }}>
                <Controller
                  name={`witnesses.${String(index)}.name` as `witnesses.${number}.name`}
                  control={control}
                  render={({ field }) => <TextField {...field} label="Ad/tanım" fullWidth />}
                />
                <Controller
                  name={`witnesses.${String(index)}.contact` as `witnesses.${number}.contact`}
                  control={control}
                  render={({ field }) => <TextField {...field} label="İletişim" fullWidth />}
                />
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    removeWitness(index);
                  }}
                >
                  Kaldır
                </Button>
              </Stack>
            ))}
            <Button
              variant="outlined"
              onClick={() => {
                appendWitness({ name: '' });
              }}
            >
              Tanık ekle
            </Button>

            <Controller
              name="previouslyReported"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <Typography variant="subtitle2" gutterBottom>
                    Daha önce bildirildi mi?
                  </Typography>
                  <RadioGroup
                    row
                    value={field.value ? 'yes' : 'no'}
                    onChange={(event) => {
                      field.onChange(event.target.value === 'yes');
                    }}
                  >
                    <FormControlLabel value="yes" control={<Radio />} label="Evet" />
                    <FormControlLabel value="no" control={<Radio />} label="Hayır" />
                  </RadioGroup>
                </FormControl>
              )}
            />

            {previouslyReported ? (
              <Controller
                name="previouslyReportedTo"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Önceki bildirim yeri"
                    fullWidth
                    error={Boolean(errors.previouslyReportedTo)}
                    helperText={errors.previouslyReportedTo?.message}
                  />
                )}
              />
            ) : null}

            <Controller
              name="urgentRiskFlag"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <Typography variant="subtitle2" gutterBottom>
                    Acil güvenlik riski var mı?
                  </Typography>
                  <RadioGroup
                    row
                    value={field.value ? 'yes' : 'no'}
                    onChange={(event) => {
                      field.onChange(event.target.value === 'yes');
                    }}
                  >
                    <FormControlLabel value="yes" control={<Radio />} label="Evet" />
                    <FormControlLabel value="no" control={<Radio />} label="Hayır" />
                  </RadioGroup>
                </FormControl>
              )}
            />

            {urgentRiskFlag ? (
              <Controller
                name="urgentRiskDescription"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Acil risk açıklaması"
                    fullWidth
                    multiline
                    minRows={3}
                    error={Boolean(errors.urgentRiskDescription)}
                    helperText={errors.urgentRiskDescription?.message}
                  />
                )}
              />
            ) : null}
          </Stack>
        );

      case 5:
        return <DynamicCategoryFields control={control} errors={errors} />;

      case 6:
        return (
          <FileUploadZone
            attachments={wizard.attachments}
            onAdd={wizard.addAttachments}
            onRemove={wizard.removeAttachment}
          />
        );

      case 7:
        return (
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Kimlik Tercihi
            </Typography>
            <Controller
              name="isAnonymous"
              control={control}
              render={({ field }) => (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Card
                      variant={field.value ? 'elevation' : 'outlined'}
                      sx={{ borderColor: field.value ? 'primary.main' : 'divider' }}
                    >
                      <CardActionArea
                        onClick={() => {
                          field.onChange(true);
                        }}
                      >
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={600}>
                            Anonim kalmak istiyorum
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Kimlik bilgileriniz paylaşılmaz.
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Card
                      variant={!field.value ? 'elevation' : 'outlined'}
                      sx={{ borderColor: !field.value ? 'primary.main' : 'divider' }}
                    >
                      <CardActionArea
                        onClick={() => {
                          field.onChange(false);
                        }}
                      >
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight={600}>
                            Kimliğimi paylaşmak istiyorum
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            İletişim bilgilerinizi gönüllü olarak girebilirsiniz.
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                </Grid>
              )}
            />

            {!isAnonymous ? (
              <Stack spacing={2}>
                <Controller
                  name="reporterIdentityName"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} value={field.value ?? ''} label="Ad soyad" fullWidth />
                  )}
                />
                <Controller
                  name="reporterIdentityTitle"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} value={field.value ?? ''} label="Pozisyon" fullWidth />
                  )}
                />
                <Controller
                  name="reporterIdentityRelation"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel id="relation-label">İlişki</InputLabel>
                      <Select
                        {...field}
                        value={field.value ?? ''}
                        labelId="relation-label"
                        label="İlişki"
                      >
                        <MenuItem value="">
                          <em>Seçiniz</em>
                        </MenuItem>
                        {Object.entries(REPORTER_IDENTITY_RELATION_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
                <Controller
                  name="reporterContactEmail"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value ?? ''}
                      label="E-posta"
                      type="email"
                      fullWidth
                      error={Boolean(errors.reporterContactEmail)}
                      helperText={errors.reporterContactEmail?.message}
                    />
                  )}
                />
                <Controller
                  name="reporterContactPhone"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} value={field.value ?? ''} label="Telefon" fullWidth />
                  )}
                />
              </Stack>
            ) : null}
          </Stack>
        );

      case 8:
        return <TrackingPasswordSection control={control} errors={errors} />;

      case 9:
        return (
          <Stack spacing={2}>
            <Typography variant="h6" component="h2">
              Gönderim Özeti
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Bilgilerinizi kontrol edin. Gönderim sonrası takip kodunuz oluşturulacaktır.
            </Typography>

            <SummarySection title="Konum" stepIndex={1} onEdit={wizard.goToStep}>
              <Typography variant="body2">
                {watch('reporterCity')}, {watch('reporterCountry')}
              </Typography>
            </SummarySection>

            <SummarySection title="Şirket & Olay Yeri" stepIndex={2} onEdit={wizard.goToStep}>
              <Typography variant="body2">
                Şirket: {companiesQuery.data?.find((c) => c.id === watch('companyId'))?.name ?? '—'}
              </Typography>
              <Typography variant="body2">
                Olay yeri: {watch('incidentCity')}, {watch('incidentCountry')}
              </Typography>
            </SummarySection>

            <SummarySection title="Kategori" stepIndex={3} onEdit={wizard.goToStep}>
              <Typography variant="body2">
                {watch('categories').join(', ') || 'Genel etik ihlali'}
              </Typography>
            </SummarySection>

            <SummarySection title="Olay" stepIndex={4} onEdit={wizard.goToStep}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {watch('incidentDescription')}
              </Typography>
            </SummarySection>

            <SummarySection title="Dosyalar" stepIndex={6} onEdit={wizard.goToStep}>
              {wizard.attachments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Dosya eklenmedi
                </Typography>
              ) : (
                wizard.attachments.map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.file.name} ({formatBytes(item.file.size)})
                  </Typography>
                ))
              )}
            </SummarySection>

            <SummarySection title="Kimlik" stepIndex={7} onEdit={wizard.goToStep}>
              <Typography variant="body2">
                {watch('isAnonymous') ? 'Anonim bildirim' : 'Kimlik paylaşıldı'}
              </Typography>
            </SummarySection>

            {submitError ? (
              <Alert severity="error" role="alert">
                {submitError}
              </Alert>
            ) : null}
          </Stack>
        );

      default:
        return null;
    }
  };

  if (bootstrapFailed) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              void categoriesQuery.refetch();
              void companiesQuery.refetch();
              void kvkkQuery.refetch();
            }}
          >
            Tekrar Dene
          </Button>
        }
      >
        Form verileri yüklenemedi. Lütfen tekrar deneyin.
      </Alert>
    );
  }

  return (
    <Box component="form" onSubmit={(event) => void submitReport(event)} noValidate>
      <PageHeader
        title="Etik Bildirim Formu"
        subtitle="Bildiriminizi adım adım doldurun. Tüm bilgiler gizli tutulur."
      />

      {isBootstrapping ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Form yükleniyor" />
        </Box>
      ) : (
        <>
          <StepIndicator
            activeStep={wizard.activeStep}
            maxCompletedStep={wizard.maxCompletedStep}
            onStepClick={wizard.goToStep}
            skippedSteps={skippedSteps}
          />

          <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
            {renderStepContent()}
          </Card>

          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={wizard.goBack}
              disabled={wizard.activeStep === 0 || isSubmitting}
              sx={{ visibility: wizard.activeStep === 0 ? 'hidden' : 'visible' }}
            >
              Geri
            </Button>

            {wizard.activeStep < 9 ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => void wizard.goNext()}
                disabled={isSubmitting}
              >
                İleri
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                color="primary"
                endIcon={<SendIcon />}
                disabled={isSubmitting}
              >
                Bildirimimi Gönder
              </Button>
            )}
          </Stack>
        </>
      )}

      {isSubmitting ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(255,255,255,0.72)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: (theme) => theme.zIndex.modal + 1,
          }}
          role="alert"
          aria-live="polite"
        >
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6">Bildiriminiz gönderiliyor...</Typography>
        </Box>
      ) : null}

      <Snackbar
        open={Boolean(toastMessage)}
        autoHideDuration={4000}
        onClose={() => {
          setToastMessage(null);
        }}
        message={toastMessage}
      />
    </Box>
  );
}

type SummarySectionProps = {
  title: string;
  stepIndex: number;
  onEdit: (stepIndex: number) => void;
  children: ReactNode;
};

function SummarySection({ title, stepIndex, onEdit, children }: SummarySectionProps) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => {
            onEdit(stepIndex);
          }}
        >
          Düzenle
        </Link>
      </Stack>
      {children}
      <Divider sx={{ mt: 1.5 }} />
    </Box>
  );
}
