import React from 'react';
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
  Chip,
  Avatar,
  Stack,
  Divider
} from '@mui/material';
import {
  AccountCircle,
  Dashboard,
  CameraAlt,
  PhotoLibrary,
  FolderOpen,
  History,
  Settings,
  Logout,
  NotificationsNone
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = React.useState(null);

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

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <Dashboard /> },
    { label: 'AI Shot Suggestor', path: '/shot-suggestor', icon: <CameraAlt /> },
    { label: 'Smart Angle Generator', path: '/image-fusion', icon: <PhotoLibrary /> },
    { label: 'Projects', path: '/projects', icon: <FolderOpen /> },
    { label: 'Sessions', path: '/sessions', icon: <History /> },
  ];

  const isCurrentPath = (path) => location.pathname === path;

  return (
    <AppBar 
      position="static" 
      elevation={0}
      sx={{ 
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'grey.200'
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: '72px !important' }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
            <Typography
              variant="h5"
              component={RouterLink}
              to="/dashboard"
              sx={{
                fontWeight: 700,
                color: 'primary.main',
                textDecoration: 'none',
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              🎬 SHOT-SUGGESTOR
            </Typography>
            <Chip 
              label="AI" 
              size="small" 
              color="primary" 
              sx={{ ml: 2, fontWeight: 600 }}
            />
          </Box>

          {/* Navigation Items */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                startIcon={item.icon}
                sx={{
                  color: isCurrentPath(item.path) ? 'primary.main' : 'text.secondary',
                  fontWeight: isCurrentPath(item.path) ? 600 : 500,
                  bgcolor: isCurrentPath(item.path) ? 'primary.50' : 'transparent',
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  '&:hover': {
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                  },
                  textTransform: 'none',
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          {/* User Menu */}
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main' }
                }}
              >
                <NotificationsNone />
              </IconButton>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32, 
                    bgcolor: 'primary.main',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  {user.username?.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {user.username}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Creative Professional
                  </Typography>
                </Box>
              </Box>

              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main' }
                }}
              >
                <Settings />
              </IconButton>
              
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
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 200,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                  }
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {user.username}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Account Settings
                  </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={handleClose} sx={{ py: 1.5 }}>
                  <AccountCircle sx={{ mr: 2, color: 'text.secondary' }} />
                  Profile
                </MenuItem>
                <MenuItem onClick={handleClose} sx={{ py: 1.5 }}>
                  <Settings sx={{ mr: 2, color: 'text.secondary' }} />
                  Settings
                </MenuItem>
                <Divider />
                <MenuItem 
                  onClick={handleLogout} 
                  sx={{ 
                    py: 1.5,
                    color: 'error.main',
                    '&:hover': { bgcolor: 'error.50' }
                  }}
                >
                  <Logout sx={{ mr: 2 }} />
                  Sign Out
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
            }}
          >
            Shot Suggestor
          </Typography>
          
          <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
            {user && (
              <Button
                component={RouterLink}
                to="/dashboard"
                sx={{ color: 'white' }}
              >
                Dashboard
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {user ? (
              <>
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  color="inherit"
                >
                  <AccountCircle />
                </IconButton>
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
                >
                  <MenuItem disabled>
                    {user.username}
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>Logout</MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Button
                  component={RouterLink}
                  to="/login"
                  sx={{ color: 'white' }}
                >
                  Login
                </Button>
                <Button
                  component={RouterLink}
                  to="/register"
                  sx={{ color: 'white' }}
                >
                  Register
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar; 