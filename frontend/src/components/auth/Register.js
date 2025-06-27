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

const Register = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return; // This should be handled by form validation
    }
    
    setLoading(true);
    const success = await register(username, password, confirmPassword);
    if (success) {
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={0} sx={{ 
          minHeight: '80vh',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: `
            0 32px 64px -12px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(255, 255, 255, 0.1)
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
                radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%),
                radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0%, transparent 50%)
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
                <Box>
                  {/* Main Branding */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                    <Avatar sx={{ 
                      width: 64, 
                      height: 64, 
                      background: 'rgba(255,255,255,0.15)',
                      border: '2px solid rgba(255,255,255,0.2)',
                      mr: 3
                    }}>
                      <CameraAlt sx={{ fontSize: 32, color: 'white' }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h3" sx={{ 
                        fontWeight: 700, 
                        color: 'white',
                        mb: 0.5
                      }}>
                        Shot Suggestor
                      </Typography>
                      <Typography variant="h6" sx={{ 
                        color: 'rgba(255,255,255,0.8)',
                        fontWeight: 400
                      }}>
                        AI-Powered Photography Assistant
                      </Typography>
                    </Box>
                  </Box>                  {/* Features */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h5" sx={{ 
                      color: 'white', 
                      mb: 3,
                      fontWeight: 600
                    }}>
                      Join the AI Photography Revolution
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CameraAlt sx={{ 
                          color: 'rgba(255,255,255,0.9)', 
                          mr: 2,
                          fontSize: 24
                        }} />
                        <Typography variant="body1" sx={{ 
                          color: 'rgba(255,255,255,0.9)',
                          fontSize: '1.1rem'
                        }}>
                          Shot Suggestor: Enter scene descriptions to get professional shot suggestions with explanations and image generation
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ViewInAr sx={{ 
                          color: 'rgba(255,255,255,0.9)', 
                          mr: 2,
                          fontSize: 24
                        }} />
                        <Typography variant="body1" sx={{ 
                          color: 'rgba(255,255,255,0.9)',
                          fontSize: '1.1rem'
                        }}>
                          Image Fusion: Upload reference images, analyze themes, and generate similar styled images with your desired angles
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Call to action */}
                  <Box sx={{ 
                    background: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: 3,
                    p: 3,
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}>                    <Typography variant="body1" sx={{ 
                      color: 'rgba(255,255,255,0.95)',
                      textAlign: 'center',
                      fontSize: '1.1rem',
                      fontStyle: 'italic'
                    }}>
                      "Start creating perfect shots and fusion images with AI today"
                    </Typography>
                  </Box>
                </Box>
              </Fade>
            </Container>
          </Grid>

          {/* Right Side - Register Form */}
          <Grid item xs={12} lg={5} sx={{ 
            display: 'flex', 
            alignItems: 'center',
            background: 'white',
            py: { xs: 4, lg: 0 }
          }}>
            <Container maxWidth="sm" sx={{ px: { xs: 3, sm: 4 } }}>
              <Slide direction="left" in timeout={800}>
                <Box>
                  {/* Form Header */}
                  <Box sx={{ mb: 4, textAlign: 'center' }}>                    <Typography variant="h4" sx={{ 
                      fontWeight: 600, 
                      color: '#1a365d',
                      mb: 1
                    }}>
                      Create Account
                    </Typography>                    <Typography variant="body1" sx={{ color: '#64748b' }}>
                      Join Shot Suggestor today
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

                    <TextField
                      fullWidth
                      label="Confirm Password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      variant="outlined"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      error={confirmPassword && password !== confirmPassword}
                      helperText={
                        confirmPassword && password !== confirmPassword 
                          ? 'Passwords do not match' 
                          : ''
                      }
                      sx={{ mb: 3 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label="toggle confirm password visibility"
                              onClick={handleToggleConfirmPassword}
                              edge="end"
                            >
                              {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    
                    <Button
                      type="submit"
                      fullWidth
                      variant="contained"
                      disabled={loading || password !== confirmPassword}                      sx={{ 
                        py: 1.5,
                        mb: 3,
                        borderRadius: 1.5,
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
                      {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
                    </Button>
                    
                    <Box sx={{ textAlign: 'center' }}>                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Already have an account?{' '}
                        <Link component={RouterLink} to="/login" sx={{ 
                          color: '#1a365d',
                          textDecoration: 'none',
                          fontWeight: 500,
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}>
                          Sign in
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

export default Register;
