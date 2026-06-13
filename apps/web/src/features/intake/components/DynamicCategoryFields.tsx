import { categorySpecificDataSchemas, type CategorySpecificDataSchemas } from '@ethics/dto';
import type { ReportSubCategoryCode } from '@ethics/shared';
import { Box, FormHelperText, Stack, TextField, Typography } from '@mui/material';
import type { Control, FieldErrors } from 'react-hook-form';
import { Controller, useWatch } from 'react-hook-form';

import { CATEGORY_FIELD_CONFIGS } from '@/features/intake/constants/category-field-config';
import type { ReportFormValues } from '@/features/intake/schemas/report-form.schema';

type DynamicCategoryFieldsProps = {
  control: Control<ReportFormValues>;
  errors: FieldErrors<ReportFormValues>;
};

export function DynamicCategoryFields({ control, errors }: DynamicCategoryFieldsProps) {
  const categories = useWatch({ control, name: 'categories' });
  const relevantCategories = (categories as ReportSubCategoryCode[]).filter(
    (category) => category in categorySpecificDataSchemas,
  ) as Array<keyof CategorySpecificDataSchemas>;

  if (relevantCategories.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Seçilen kategoriler için ek soru bulunmuyor.
      </Typography>
    );
  }

  return (
    <Stack spacing={3}>
      {relevantCategories.map((categoryCode: keyof CategorySpecificDataSchemas) => {
        const fields = CATEGORY_FIELD_CONFIGS[categoryCode] ?? [];

        return (
          <Box key={categoryCode}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              {categoryCode} — Ek Sorular
            </Typography>
            <Stack spacing={2}>
              {fields.map((fieldConfig) => (
                <Controller
                  key={fieldConfig.name}
                  name="categorySpecificData"
                  control={control}
                  render={({ field }) => {
                    const record = field.value ?? {};

                    return (
                      <TextField
                        label={fieldConfig.label}
                        fullWidth
                        multiline={fieldConfig.type === 'textarea'}
                        minRows={fieldConfig.type === 'textarea' ? 3 : undefined}
                        slotProps={{
                          htmlInput: { maxLength: fieldConfig.maxLength },
                        }}
                        value={
                          typeof record[fieldConfig.name] === 'string'
                            ? record[fieldConfig.name]
                            : ''
                        }
                        onChange={(event) => {
                          field.onChange({
                            ...record,
                            [fieldConfig.name]: event.target.value,
                          });
                        }}
                      />
                    );
                  }}
                />
              ))}
            </Stack>
          </Box>
        );
      })}

      {errors.categorySpecificData ? (
        <FormHelperText error role="alert">
          {typeof errors.categorySpecificData.message === 'string'
            ? errors.categorySpecificData.message
            : 'Kategori bazlı alanları kontrol ediniz.'}
        </FormHelperText>
      ) : null}
    </Stack>
  );
}
