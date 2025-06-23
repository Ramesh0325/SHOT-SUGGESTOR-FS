import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Container,
  Avatar,
  Tooltip,
  Divider,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  AccountCircle,
  Dashboard,
  CameraAlt,
  PhotoLibrary,
  FolderOpen,
  History,
  Logout
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const SimpleNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    logout();
    navigate('/login');
  };
  const navigationItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <Dashboard /> },
    { label: 'Shot Suggestor', path: '/shot-suggestor', icon: <CameraAlt /> },
    { label: 'Image Fusion', path: '/image-fusion', icon: <PhotoLibrary /> },
  ];

  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{
        background: 'linear-gradient(135deg, #1a365d 0%, #2a4a6b 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                mr: 2,
              }}
            >
              <CameraAlt sx={{ fontSize: 20, color: 'white' }} />
            </Avatar>
            <Typography
              variant="h6"
              noWrap
              component={RouterLink}
              to="/dashboard"
              sx={{
                fontWeight: 700,
                color: 'white',
                textDecoration: 'none',
                fontSize: '1.3rem',
                '&:hover': {
                  color: 'rgba(255,255,255,0.9)',
                },
              }}
            >
              Shot Suggestor
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            {user && navigationItems.map((item) => (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                startIcon={item.icon}
                sx={{
                  color: location.pathname === item.path ? 'white' : 'rgba(255,255,255,0.8)',
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  backgroundColor: location.pathname === item.path ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                  textTransform: 'none',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {user ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: 500,
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    {user.username}
                  </Typography>
                  <Tooltip title="Account settings">
                    <IconButton
                      size="large"
                      aria-label="account of current user"
                      aria-controls="menu-appbar"
                      aria-haspopup="true"
                      onClick={handleMenu}
                      sx={{
                        color: 'white',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.1)',
                        },
                      }}
                    >
                      <AccountCircle sx={{ fontSize: 32 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                  sx={{
                    mt: 1,
                    '& .MuiPaper-root': {
                      backgroundColor: 'white',
                      borderRadius: 2,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      border: '1px solid rgba(0,0,0,0.05)',
                      minWidth: 200,
                    },
                  }}
                >
                  <MenuItem disabled sx={{ opacity: 1, cursor: 'default' }}>
                    <ListItemIcon>
                      <AccountCircle sx={{ color: '#1a365d' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={user.username}
                      secondary="Account"
                      primaryTypographyProps={{
                        fontWeight: 600,
                        color: '#1a365d',
                      }}
                      secondaryTypographyProps={{
                        color: '#64748b',
                      }}
                    />
                  </MenuItem>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                      <Logout sx={{ color: '#e53e3e' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Logout"
                      primaryTypographyProps={{
                        color: '#e53e3e',
                      }}
                    />
                  </MenuItem>
                </Menu>
              </>
            ) : null}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default SimpleNavbar;