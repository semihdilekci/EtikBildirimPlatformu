import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { adminNavItems } from '@/config/internal-navigation';
import { YildizHoldingLogo } from '@/components/brand';
import { PermissionGate } from '@/features/auth/components/PermissionGate';
import { useLogout } from '@/features/auth/hooks/useLogout';
import { useAuthStore } from '@/stores/useAuthStore';

const DRAWER_WIDTH = 240;

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const result = await logoutMutation.mutateAsync();
      if (result.idpLogoutUrl) {
        window.location.assign(result.idpLogoutUrl);
        return;
      }
    } catch {
      // Session zaten sonlanmış olabilir; yine de login'e yönlendir.
    }

    void navigate('/auth/login', { replace: true });
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          Yönetim Konsolu
        </Typography>
      </Toolbar>
      <List sx={{ flex: 1, px: 1 }}>
        {adminNavItems.map((item) => (
          <PermissionGate key={item.path} permission={item.permission}>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={location.pathname === item.path}
              onClick={() => {
                setMobileOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </PermissionGate>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="default"
        sx={{
          width: { sm: `calc(100% - ${String(DRAWER_WIDTH)}px)` },
          ml: { sm: `${String(DRAWER_WIDTH)}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => {
              setMobileOpen((open) => !open);
            }}
            sx={{ mr: 1, display: { sm: 'none' } }}
            aria-label="Menüyü aç"
          >
            <MenuIcon />
          </IconButton>
          <YildizHoldingLogo to="/app/admin" height={20} marginRight={1} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ flexGrow: 1 }}>
            Yönetim Konsolu
          </Typography>
          <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' }, mr: 1 }}>
            {user?.displayName ?? user?.email}
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => void handleLogout()}
            disabled={logoutMutation.isPending}
            aria-label="Çıkış yap"
          >
            <LogoutOutlinedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => {
            setMobileOpen(false);
          }}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${String(DRAWER_WIDTH)}px)` },
          mt: 8,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
