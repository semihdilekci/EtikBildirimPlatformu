import { Box, Step, StepButton, StepLabel, Stepper, Typography } from '@mui/material';

import { REPORT_FORM_STEP_LABELS } from '@/features/intake/constants/enum-labels';

/** MUI StepIcon default 24px + %20 */
const STEP_ICON_SIZE_PX = 24 * 1.2;

type StepIndicatorProps = {
  activeStep: number;
  maxCompletedStep: number;
  onStepClick: (stepIndex: number) => void;
  skippedSteps?: readonly number[];
};

export function StepIndicator({
  activeStep,
  maxCompletedStep,
  onStepClick,
  skippedSteps = [],
}: StepIndicatorProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Adım {activeStep + 1} / {REPORT_FORM_STEP_LABELS.length}
      </Typography>
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        nonLinear
        aria-label="Bildirim formu adımları"
        sx={{
          '& .MuiStepIcon-root': {
            width: STEP_ICON_SIZE_PX,
            height: STEP_ICON_SIZE_PX,
          },
          '& .MuiStepIcon-text': {
            fontSize: `${String(0.75 * 1.2)}rem`,
          },
        }}
      >
        {REPORT_FORM_STEP_LABELS.map((label, index) => {
          const isSkipped = skippedSteps.includes(index);
          const isCompleted = index < activeStep && !isSkipped;
          const isClickable = index <= maxCompletedStep && index !== activeStep;

          return (
            <Step key={label} completed={isCompleted}>
              <StepButton
                onClick={() => {
                  if (isClickable) {
                    onStepClick(index);
                  }
                }}
                disabled={!isClickable}
                aria-current={index === activeStep ? 'step' : undefined}
              >
                <StepLabel>
                  <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                    {isCompleted ? '✓ ' : ''}
                    {isSkipped ? '(atlandı) ' : ''}
                    {label}
                  </Box>
                </StepLabel>
              </StepButton>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
}
