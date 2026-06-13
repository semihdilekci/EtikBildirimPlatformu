import { Box } from '@mui/material';
import type { ReactNode } from 'react';

type SectionVariant = 'default' | 'muted' | 'paper';

type SectionProps = {
  children: ReactNode;
  variant?: SectionVariant;
};

const variantBg: Record<SectionVariant, string | undefined> = {
  default: undefined,
  muted: 'grey.100',
  paper: 'background.paper',
};

export function Section({ children, variant = 'default' }: SectionProps) {
  return (
    <Box
      component="section"
      sx={{
        borderRadius: 2,
        ...(variantBg[variant] ? { bgcolor: variantBg[variant] } : {}),
      }}
    >
      {children}
    </Box>
  );
}
