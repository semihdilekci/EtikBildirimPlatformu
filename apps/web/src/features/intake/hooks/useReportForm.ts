import { useCallback, useMemo, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  hasDynamicCategoryStep,
  REPORT_STEP_FIELDS,
  type ReportFormValues,
} from '@/features/intake/schemas/report-form.schema';

const DYNAMIC_STEP_INDEX = 5;
const SUMMARY_STEP_INDEX = 9;

export type PendingAttachment = {
  id: string;
  file: File;
};

export function useReportFormWizard(form: UseFormReturn<ReportFormValues>) {
  const [activeStep, setActiveStep] = useState(0);
  const [maxCompletedStep, setMaxCompletedStep] = useState(0);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [dynamicStepSkipped, setDynamicStepSkipped] = useState(false);

  const categories = form.watch('categories');
  const showDynamicStep = useMemo(() => hasDynamicCategoryStep(categories), [categories]);

  const resolveNextStep = useCallback(
    (fromStep: number): number => {
      if (fromStep === DYNAMIC_STEP_INDEX - 1 && !showDynamicStep) {
        setDynamicStepSkipped(true);
        return DYNAMIC_STEP_INDEX + 1;
      }

      if (fromStep >= DYNAMIC_STEP_INDEX) {
        setDynamicStepSkipped(!showDynamicStep);
      }

      return fromStep + 1;
    },
    [showDynamicStep],
  );

  const resolvePreviousStep = useCallback(
    (fromStep: number): number => {
      if (fromStep === DYNAMIC_STEP_INDEX + 1 && dynamicStepSkipped) {
        return DYNAMIC_STEP_INDEX - 1;
      }

      return fromStep - 1;
    },
    [dynamicStepSkipped],
  );

  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const fields = REPORT_STEP_FIELDS[activeStep];
    if (!fields || fields.length === 0) {
      return true;
    }

    return form.trigger([...fields]);
  }, [activeStep, form]);

  const goNext = useCallback(async (): Promise<boolean> => {
    const isValid = await validateCurrentStep();
    if (!isValid) {
      return false;
    }

    const nextStep = resolveNextStep(activeStep);
    setActiveStep(nextStep);
    setMaxCompletedStep((current) => Math.max(current, nextStep));
    return true;
  }, [activeStep, resolveNextStep, validateCurrentStep]);

  const goBack = useCallback(() => {
    if (activeStep === 0) {
      return;
    }

    setActiveStep(resolvePreviousStep(activeStep));
  }, [activeStep, resolvePreviousStep]);

  const goToStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex <= maxCompletedStep && stepIndex !== activeStep) {
        setActiveStep(stepIndex);
      }
    },
    [activeStep, maxCompletedStep],
  );

  const addAttachments = useCallback((files: File[]) => {
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
      })),
    ]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
  }, []);

  const isLastInputStep = activeStep === SUMMARY_STEP_INDEX - 1;

  return {
    activeStep,
    maxCompletedStep,
    attachments,
    showDynamicStep,
    dynamicStepSkipped,
    isLastInputStep,
    goNext,
    goBack,
    goToStep,
    addAttachments,
    removeAttachment,
    setActiveStep,
  };
}
