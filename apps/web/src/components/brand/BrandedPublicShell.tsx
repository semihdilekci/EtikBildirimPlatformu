import { AppBar, Box, Container, Link, Toolbar, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { YildizHoldingLogo } from './YildizHoldingLogo';

const KVKK_FOOTER =
  'Kişisel verileriniz 6698 sayılı KVKK kapsamında, yalnızca etik bildirim sürecinin yürütülmesi amacıyla işlenmektedir.';

type BrandedPublicShellProps = {
  logoTo: string;
  subtitle: string;
  navLink: { to: string; label: string };
  children: ReactNode;
};

export function BrandedPublicShell({
  logoTo,
  subtitle,
  navLink,
  children,
}: BrandedPublicShellProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <AppBar position="static" color="default">
        <Toolbar sx={{ gap: 2 }}>
          <YildizHoldingLogo to={logoTo} height={22} />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            {subtitle}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Link
            component={RouterLink}
            to={navLink.to}
            color="inherit"
            underline="hover"
            variant="body2"
          >
            {navLink.label}
          </Link>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, py: { xs: 3, md: 4 } }}>
        <Container maxWidth="md">{children}</Container>
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
            {KVKK_FOOTER}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
