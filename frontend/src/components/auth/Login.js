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
  InputAdornment,
  Grid,
  Avatar,
  Fade,
  Slide,
  Divider
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CameraAlt,
  ViewInAr
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, error } = useAuth();
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
  };  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={0} sx={{ 
          minHeight: '80vh',
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: `
            0 8px 32px rgba(0, 0, 0, 0.08),
            0 0 0 1px rgba(0, 0, 0, 0.04)
          `
        }}>
            {/* Left Side - Project Branding */}          <Grid item xs={12} lg={7} sx={{ 
            display: 'flex', 
            alignItems: 'center',
            background: 'linear-gradient(135deg, #1a365d 0%, #2a4a6b 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Subtle background pattern */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `
                radial-gradient(circle at 25% 25%, rgba(255,255,255,0.06) 0%, transparent 50%),
                radial-gradient(circle at 75% 75%, rgba(255,255,255,0.03) 0%, transparent 50%)
              `,
              zIndex: 1
            }} />
            
            <Container maxWidth="md" sx={{ 
              px: { xs: 3, sm: 6 }, 
              color: 'white', 
              position: 'relative', 
              zIndex: 2 
            }}>
              <Fade in timeout={1000}>
                <Box>                  {/* Main Branding */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                    <Avatar sx={{ 
                      width: 56, 
                      height: 56, 
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      mr: 3
                    }}>
                      <CameraAlt sx={{ fontSize: 28, color: 'rgba(255,255,255,0.9)' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h3" sx={{ 
                        fontWeight: 600, 
                        color: 'white',
                        mb: 0.5,
                        fontSize: { xs: '2rem', sm: '2.5rem' }
                      }}>
                        Shot Suggestor
                      </Typography>
                      <Typography variant="h6" sx={{ 
                        color: 'rgba(255,255,255,0.75)',
                        fontWeight: 300,
                        fontSize: '1.1rem'
                      }}>
                        AI-Powered Photography Assistant
                      </Typography>
                    </Box>
                  </Box>                  {/* Features */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" sx={{ 
                      color: 'white', 
                      mb: 3,
                      fontWeight: 500,
                      fontSize: '1.4rem'
                    }}>
                      Two Powerful AI Tools
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CameraAlt sx={{ 
                          color: 'rgba(255,255,255,0.8)', 
                          mr: 2,
                          fontSize: 20
                        }} />
                        <Typography variant="body1" sx={{ 
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '1rem',
                          fontWeight: 300
                        }}>
                          Shot Suggestor: Enter scene description, get shot suggestions with explanations and generate images
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ViewInAr sx={{ 
                          color: 'rgba(255,255,255,0.8)', 
                          mr: 2,
                          fontSize: 20
                        }} />
                        <Typography variant="body1" sx={{ 
                          color: 'rgba(255,255,255,0.8)',
                          fontSize: '1rem',
                          fontWeight: 300
                        }}>
                          Image Fusion: Upload images, analyze themes, and generate similar images with desired angles
                        </Typography>
                      </Box>
                    </Box>
                  </Box>{/* Call to action */}
                  <Box sx={{ 
                    background: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 2,
                    p: 3,
                    border: '1px solid rgba(255,255,255,0.12)'
                  }}>                    <Typography variant="body1" sx={{ 
                      color: 'rgba(255,255,255,0.85)',
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: 300,
                      lineHeight: 1.5
                    }}>
                      "Transform your photography with AI-powered scene analysis and shot creation"
                    </Typography>
                  </Box>
                </Box>
              </Fade>
            </Container>
          </Grid>

          {/* Right Side - Login Form */}
          <Grid item xs={12} lg={5} sx={{ 
            display: 'flex', 
            alignItems: 'center',
            background: 'white',
            py: { xs: 4, lg: 0 }
          }}>
            <Container maxWidth="sm" sx={{ px: { xs: 3, sm: 4 } }}>
              <Slide direction="left" in timeout={800}>
                <Box>                  {/* Form Header */}
                  <Box sx={{ mb: 4, textAlign: 'center' }}>                    <Typography variant="h4" sx={{ 
                      fontWeight: 500, 
                      color: '#1a365d',
                      mb: 1,
                      fontSize: '1.8rem'
                    }}>
                      Welcome Back
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      color: '#78909c',
                      fontWeight: 300
                    }}>
                      Sign in to your account
                    </Typography>
                  </Box>

                  {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      {error}
                    </Alert>
                  )}                  <Box component="form" onSubmit={handleSubmit}>
                    <TextField
                      fullWidth
                      label="Username"
                      variant="outlined"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      sx={{ 
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1.5,
                          '&:hover fieldset': {
                            borderColor: '#78909c',
                          },                          '&.Mui-focused fieldset': {
                            borderColor: '#1a365d',
                          },
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#1a365d',
                        }
                      }}
                    />
                    
                    <TextField
                      fullWidth
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      variant="outlined"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      sx={{ 
                        mb: 3,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1.5,
                          '&:hover fieldset': {
                            borderColor: '#78909c',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#455a64',
                          },
                        },                        '& .MuiInputLabel-root.Mui-focused': {
                          color: '#1a365d',
                        }
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle password visibility"
                              onClick={handleTogglePassword}
                              edge="end"
                              sx={{ color: '#1a365d' }}
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
                        mb: 3,                        borderRadius: 1.5,
                        background: '#1a365d',
                        color: 'white',
                        fontWeight: 400,
                        textTransform: 'none',
                        fontSize: '1rem',
                        '&:hover': {
                          background: '#153752',
                        },
                        '&:disabled': {
                          background: '#cfd8dc',
                        }
                      }}
                    >
                      {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                    </Button>
                    
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: '#78909c' }}>
                        Don't have an account?{' '}                        <Link component={RouterLink} to="/register" sx={{ 
                          color: '#1a365d',
                          textDecoration: 'none',
                          fontWeight: 400,
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}>
                          Sign up
                        </Link>
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Slide>
            </Container>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Login;
