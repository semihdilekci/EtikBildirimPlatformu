import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  align?: 'left' | 'center';
  dense?: boolean;
};

export function PageHeader({
  title,
  subtitle,
  action,
  align = 'left',
  dense = false,
}: PageHeaderProps) {
  const isCenter = align === 'center';

  return (
    <Stack
      direction={{ xs: 'column', sm: isCenter ? 'column' : 'row' }}
      spacing={2}
      alignItems={isCenter ? 'center' : { xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      sx={{ mb: dense ? 0 : 4, textAlign: isCenter ? 'center' : 'left' }}
    >
      <Box>
        <Typography variant="h4" component="h1" gutterBottom={Boolean(subtitle)}>
          {title}
        </Typography>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          ) : (
            subtitle
          )
        ) : null}
      </Box>
      {action && !isCenter ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      {action && isCenter ? <Box sx={{ flexShrink: 0, width: '100%' }}>{action}</Box> : null}
    </Stack>
  );
}
