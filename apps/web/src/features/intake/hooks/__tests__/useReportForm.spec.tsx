import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { useReportFormWizard } from '@/features/intake/hooks/useReportForm';
import {
  reportFormDefaultValues,
  reportFormSchema,
  type ReportFormValues,
} from '@/features/intake/schemas/report-form.schema';

function WizardHarness() {
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      ...reportFormDefaultValues,
      kvkkConsent: true,
      kvkkConsentVersion: 'v1',
    },
  });
  const wizard = useReportFormWizard(form);

  return (
    <div>
      <span data-testid="step">{wizard.activeStep}</span>
      <input
        aria-label="Şehir"
        value={form.watch('reporterCity')}
        onChange={(event) => {
          form.setValue('reporterCity', event.target.value, { shouldValidate: true });
        }}
      />
      <button type="button" onClick={() => void wizard.goNext()}>
        İleri
      </button>
      <button type="button" onClick={wizard.goBack}>
        Geri
      </button>
    </div>
  );
}

describe('useReportFormWizard', () => {
  it('keeps entered values when user navigates forward and back', async () => {
    render(<WizardHarness />);

    expect(screen.getByTestId('step')).toHaveTextContent('0');

    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('1');
    });

    fireEvent.change(screen.getByLabelText('Şehir'), { target: { value: 'İstanbul' } });

    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('2');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Geri' }));
    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('1');
    });
    expect(screen.getByLabelText('Şehir')).toHaveValue('İstanbul');
  });
});
