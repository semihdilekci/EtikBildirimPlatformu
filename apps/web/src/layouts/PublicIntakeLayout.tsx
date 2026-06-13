import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import { AppBar, Box, Container, Link, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';

export function PublicIntakeLayout() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <AppBar position="static" color="primary" elevation={1}>
        <Toolbar>
          <AccountBalanceOutlinedIcon sx={{ mr: 1.5 }} aria-hidden />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Yıldız Holding Etik Bildirim
          </Typography>
          <Link
            component={RouterLink}
            to="/tracking"
            color="inherit"
            underline="hover"
            variant="body2"
          >
            Bildirim Takibi
          </Link>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, py: { xs: 3, md: 4 } }}>
        <Container maxWidth="md">
          <Outlet />
        </Container>
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
            Kişisel verileriniz 6698 sayılı KVKK kapsamında, yalnızca etik bildirim sürecinin
            yürütülmesi amacıyla işlenmektedir.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
