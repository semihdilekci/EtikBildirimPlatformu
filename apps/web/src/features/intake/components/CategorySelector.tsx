import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  FormGroup,
  Grid2 as Grid,
  Typography,
} from '@mui/material';
import {
  ReportCategoryGroup,
  ReportSubCategory,
  type ReportCategoryCatalogEntry,
} from '@ethics/shared';
import type { Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { Controller, useWatch } from 'react-hook-form';

import { SENSITIVE_CATEGORIES } from '@/features/intake/constants/enum-labels';
import type { ReportFormValues } from '@/features/intake/schemas/report-form.schema';

type CategorySelectorProps = {
  control: Control<ReportFormValues>;
  errors: FieldErrors<ReportFormValues>;
  catalog: ReportCategoryCatalogEntry[] | undefined;
  setValue: UseFormSetValue<ReportFormValues>;
};

export function CategorySelector({ control, errors, catalog, setValue }: CategorySelectorProps) {
  const selectedGroup = useWatch({ control, name: 'categoryGroup' });
  const selectedCategories = useWatch({ control, name: 'categories' });

  const activeGroup = catalog?.find((entry) => entry.groupCode === selectedGroup);
  const showSensitiveWarning = selectedCategories.some((code: string) =>
    SENSITIVE_CATEGORIES.has(code),
  );

  return (
    <Box>
      <Typography variant="h6" component="h2" gutterBottom>
        Bildirim Kategorisi
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Olayınızı en iyi tanımlayan üst grubu ve alt kategorileri seçiniz.
      </Typography>

      <Controller
        name="categoryGroup"
        control={control}
        render={({ field }) => (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {(catalog ?? []).map((group) => (
              <Grid key={group.groupCode} size={{ xs: 12, sm: 6 }}>
                <Card
                  variant={field.value === group.groupCode ? 'elevation' : 'outlined'}
                  sx={{
                    borderColor: field.value === group.groupCode ? 'primary.main' : 'divider',
                    borderWidth: field.value === group.groupCode ? 2 : 1,
                  }}
                >
                  <CardActionArea
                    onClick={() => {
                      field.onChange(group.groupCode);
                    }}
                    aria-pressed={field.value === group.groupCode}
                  >
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {group.groupLabel}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      />

      {activeGroup ? (
        <Controller
          name="categories"
          control={control}
          render={({ field }) => (
            <FormGroup>
              {activeGroup.categories.map((category) => {
                const checked = field.value.includes(category.code);

                return (
                  <FormControlLabel
                    key={category.code}
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...field.value, category.code]
                            : field.value.filter((code: string) => code !== category.code);
                          field.onChange(next);
                        }}
                      />
                    }
                    label={category.label}
                  />
                );
              })}
            </FormGroup>
          )}
        />
      ) : null}

      <Controller
        name="isUncertainCategory"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            sx={{ mt: 2 }}
            control={
              <Checkbox
                {...field}
                checked={field.value}
                onChange={(event) => {
                  const checked = event.target.checked;
                  field.onChange(checked);
                  if (checked) {
                    setValue('categories', [ReportSubCategory.GENERAL_ETHICS_VIOLATION]);
                    setValue('categoryGroup', ReportCategoryGroup.EXTERNAL_ENVIRONMENT);
                  }
                }}
              />
            }
            label="Emin değilim / Genel etik ihlali"
          />
        )}
      />

      {errors.categories ? (
        <FormHelperText error role="alert">
          {errors.categories.message}
        </FormHelperText>
      ) : null}

      {showSensitiveWarning ? (
        <Alert severity="warning" sx={{ mt: 2 }} role="alert">
          Bu bildirim özel nitelikli kişisel veri içerebilir; yüksek gizlilik seviyesinde
          işlenecektir.
        </Alert>
      ) : null}
    </Box>
  );
}
