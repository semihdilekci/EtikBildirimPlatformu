import { Box } from '@mui/material';
import type { ReactNode } from 'react';

type FormPanelProps = {
  children: ReactNode;
  maxWidth?: number;
};

export function FormPanel({ children, maxWidth = 480 }: FormPanelProps) {
  return <Box sx={{ maxWidth, mx: 'auto', width: '100%' }}>{children}</Box>;
}
