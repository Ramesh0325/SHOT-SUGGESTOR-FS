import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    if (success) {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };
  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      py: 4
    }}>
      <Container maxWidth="sm">
        <Card sx={{ 
          p: { xs: 3, sm: 5 },
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: 4,
          boxShadow: `
            0 32px 64px -12px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.1)
          `,
        }}>
          <CardContent>
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Typography variant="h4" sx={{ 
                fontWeight: 600, 
                color: '#1a365d',
                mb: 1
              }}>
                Welcome Back
              </Typography>
              <Typography variant="body1" sx={{ color: '#64748b' }}>
                Sign in to your account
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Username"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                sx={{ mb: 3 }}
              />
              
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleTogglePassword}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{ 
                  py: 1.5,
                  mb: 3,
                  background: 'linear-gradient(135deg, #1a365d 0%, #2a4a6b 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #153752 0%, #244060 100%)',
                  }
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
              </Button>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  Don't have an account?{' '}
                  <Link component={RouterLink} to="/register" sx={{ 
                    color: '#1a365d',
                    textDecoration: 'none',
                    fontWeight: 500,
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}>
                    Sign up
                  </Link>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
          {/* Left Side - Enhanced Hero Section */}
          <Grid item xs={12} lg={7} sx={{ 
            display: 'flex', 
            alignItems: 'center',
            background: `
              linear-gradient(135deg, rgba(26, 54, 93, 0.95) 0%, rgba(42, 74, 107, 0.95) 100%),
              url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')
            `,
            borderRadius: { lg: '0 24px 24px 0' },
            position: 'relative',
            overflow: 'hidden'
          }}>
            
            {/* Hero Content */}
            <Container maxWidth="md" sx={{ px: { xs: 3, sm: 6 }, color: 'white', position: 'relative', zIndex: 2 }}>
                {/* Minimal Branding */}
              <Fade in timeout={1000}>
                <Box sx={{ mb: 6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar sx={{ 
                      width: 60, 
                      height: 60, 
                      background: 'linear-gradient(135deg, #ffffff20 0%, #ffffff10 100%)',
                      border: '2px solid rgba(255,255,255,0.2)',
                      mr: 3
                    }}>
                      <CameraAlt sx={{ fontSize: 30, color: 'white' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h4" sx={{ 
                        fontWeight: 600, 
                        color: 'white'
                      }}>
                        Welcome
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Fade>
            </Container>
          </Grid>

          {/* Right Side - Enhanced Login Form */}
          <Grid item xs={12} lg={5} sx={{ 
            display: 'flex', 
            alignItems: 'center',
            py: { xs: 4, lg: 0 }
          }}>
            <Container maxWidth="sm">
              <Slide direction="left" in timeout={800}>
                <Card sx={{ 
                  p: { xs: 3, sm: 5 },
                  background: 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 4,
                  boxShadow: `
                    0 32px 64px -12px rgba(0, 0, 0, 0.25),
                    0 0 0 1px rgba(255, 255, 255, 0.1)
                  `,
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #1a365d 0%, #2a4a6b 50%, #1a365d 100%)'
                  }
                }}>
                  <CardContent sx={{ p: 0 }}>
                    
                    {/* Form Header */}
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                      <Typography variant="h4" sx={{ 
                        fontWeight: 700, 
                        mb: 1,
                        background: 'linear-gradient(135deg, #1a365d 0%, #2a4a6b 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>
                        Welcome Back
                      </Typography>
                      <Typography variant="body1" sx={{ 
                        color: 'text.secondary',
                        fontWeight: 500
                      }}>
                        Sign in to continue your creative journey
                      </Typography>
                    </Box>
                    
                    {error && (
                      <Slide direction="down" in={!!error}>
                        <Alert 
                          severity="error" 
                          sx={{ 
                            mb: 3, 
                            borderRadius: 2,
                            border: '1px solid rgba(211, 47, 47, 0.2)',
                            '& .MuiAlert-icon': {
                              fontSize: '1.5rem'
                            }
                          }}
                        >
                          {error}
                        </Alert>
                      </Slide>
                    )}

                    <Box component="form" onSubmit={handleSubmit}>
                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="username"
                        label="Username"
                        name="username"
                        autoComplete="username"
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={loading}
                        sx={{ 
                          mb: 3,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.primary.main,
                                borderWidth: '2px'
                              }
                            },
                            '&.Mui-focused': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.primary.main,
                                borderWidth: '2px'
                              }
                            }
                          }
                        }}
                      />
                      
                      <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                aria-label="toggle password visibility"
                                onClick={handleTogglePassword}
                                edge="end"
                                disabled={loading}
                              >
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        sx={{ 
                          mb: 4,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.primary.main,
                                borderWidth: '2px'
                              }
                            },
                            '&.Mui-focused': {
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: theme.palette.primary.main,
                                borderWidth: '2px'
                              }
                            }
                          }
                        }}
                      />
                      
                      <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={loading}
                        sx={{ 
                          mb: 3,
                          py: 1.8,
                          fontSize: '1.1rem',
                          fontWeight: 600,
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, #1a365d 0%, #2a4a6b 100%)',
                          boxShadow: '0 8px 32px rgba(26, 54, 93, 0.3)',
                          transition: 'all 0.3s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #0d1b2a 0%, #1a365d 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 12px 40px rgba(26, 54, 93, 0.4)'
                          },
                          '&:disabled': {
                            background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                            color: 'white'
                          }
                        }}
                      >
                        {loading ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <CircularProgress size={20} color="inherit" />
                            <span>Signing In...</span>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PlayCircle sx={{ fontSize: 20 }} />
                            <span>Sign In</span>
                          </Box>
                        )}
                      </Button>
                      
                      <Divider sx={{ mb: 3, opacity: 0.6 }} />
                      
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                          New to Shot-Suggestor?
                        </Typography>
                        <Link 
                          component={RouterLink} 
                          to="/register" 
                          variant="body1"
                          sx={{ 
                            fontWeight: 600,
                            textDecoration: 'none',
                            background: 'linear-gradient(135deg, #1a365d 0%, #2a4a6b 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            position: 'relative',
                            '&:hover': {
                              '&::after': {
                                width: '100%'
                              }
                            },
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              bottom: -2,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 2,
                              background: 'linear-gradient(135deg, #1a365d 0%, #2a4a6b 100%)',
                              transition: 'width 0.3s ease'
                            }
                          }}
                        >
                          Create your account →
                        </Link>
                      </Box>};

export default Login;