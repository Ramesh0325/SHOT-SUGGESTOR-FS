import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Container,
  Chip,
  Avatar
} from '@mui/material';
import {
  CameraAlt,
  PhotoLibrary,
  AutoAwesome,
  Psychology,
  Star,
  ArrowForward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const FixedDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleFeatureClick = (route) => {
    navigate(route);
  };

  return (<Box sx={{ 
      minHeight: '100vh',
      height: '100vh',
      background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
      pt: 5, // Reduced padding for more space
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Container maxWidth="xl" sx={{ py: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{/* Hero Section */}
        <Box sx={{ textAlign: 'center', mb: 2, flexShrink: 0 }}>
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom
            sx={{ 
              fontWeight: 700,
              background: 'linear-gradient(135deg, #37474f 0%, #78909c 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}
          >
            Welcome to SHOT-SUGGESTOR
          </Typography>            <Typography 
              variant="subtitle1" 
              color="text.secondary" 
              sx={{ 
                mb: 2, 
                maxWidth: '600px', 
                mx: 'auto',
                fontWeight: 300,
                lineHeight: 1.4
              }}
            >
              Your professional AI-powered creative companion for advanced shot suggestions and intelligent image fusion
            </Typography>            {/* Feature Badges - FIXED: Direct JSX rendering */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              <Chip 
                icon={<AutoAwesome />} 
                label="AI-Powered" 
                variant="outlined"
                size="small"
                sx={{ 
                  borderRadius: 4,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  fontWeight: 500,
                  fontSize: '0.75rem'
                }}
              />
              <Chip 
                icon={<Psychology />} 
                label="Creative Intelligence" 
                variant="outlined"
                size="small"
                sx={{ 
                  borderRadius: 4,
                  borderColor: 'secondary.main',
                  color: 'secondary.main',
                  fontWeight: 500,
                  fontSize: '0.75rem'
                }}
              />
              <Chip 
                icon={<Star />} 
                label="Professional Grade" 
                variant="outlined"
                size="small"
                sx={{ 
                  borderRadius: 4,
                  borderColor: 'warning.main',
                  color: 'warning.main',
                  fontWeight: 500,
                  fontSize: '0.75rem'
                }}
              />
            </Box>
          </Box>        {/* Main Features - Optimized for center alignment */}
        <Grid container spacing={4} sx={{ 
          flex: 1, 
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 2, md: 4 },
          maxWidth: '1200px',
          mx: 'auto'
        }}>
          {/* Shot Suggestion Feature */}
          <Grid item xs={12} md={6} sx={{ display: 'flex' }}>            <Card              sx={{ 
                  height: '220px',
                  minHeight: '220px',
                  maxHeight: '220px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  borderRadius: 2,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(135deg, #455a64 0%, #607d8b 100%)',
                    zIndex: 1
                  }
                }}
                onClick={() => handleFeatureClick('/shot-suggestor')}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 2
                  }}
                >
                  <Chip
                    label="Most Popular"
                    size="small"
                    sx={{
                      background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%)',
                      color: 'white',
                      fontWeight: 'bold',
                      border: 'none'
                    }}
                  />
                </Box>                <CardContent sx={{ 
                  flexGrow: 1, 
                  p: 3, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  height: 'calc(100% - 4px)', // Account for the top border
                  boxSizing: 'border-box'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar 
                      sx={{ 
                        width: 60, 
                        height: 60,
                        background: 'linear-gradient(135deg, #455a64 0%, #607d8b 100%)',
                        mr: 3,
                        boxShadow: 2,
                        flexShrink: 0
                      }}
                    >
                      <CameraAlt sx={{ fontSize: 28, color: 'white' }} />
                    </Avatar>                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <Typography variant="h5" component="h2" fontWeight="bold" sx={{ mb: 1, lineHeight: 1.2 }}>
                        Shot Suggestion
                      </Typography>
                      <Typography variant="body2" color="text.secondary" fontWeight="medium" sx={{ mb: 1, lineHeight: 1.3 }}>
                        AI-Powered Cinematography
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ 
                        lineHeight: 1.4, 
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        Enter scene descriptions and receive professional shot suggestions with detailed explanations. Generate stunning images for each suggested shot angle.
                      </Typography>
                    </Box>
                  </Box>                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                      1.2K+ suggestions generated
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: '#455a64' }}>
                      <Typography variant="body2" fontWeight="medium" sx={{ mr: 1, fontSize: '0.875rem' }}>
                        Get Started
                      </Typography>
                      <ArrowForward sx={{ fontSize: 16 }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
          </Grid>          {/* Image Fusion Feature */}
          <Grid item xs={12} md={6} sx={{ display: 'flex' }}>            <Card              sx={{ 
                  height: '220px',
                  minHeight: '220px',
                  maxHeight: '220px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  borderRadius: 2,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(135deg, #78909c 0%, #90a4ae 100%)',
                    zIndex: 1
                  }
                }}
                onClick={() => handleFeatureClick('/image-fusion')}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    zIndex: 2
                  }}
                >
                  <Chip
                    label="New Features"
                    size="small"
                    sx={{
                      background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                      color: 'white',
                      fontWeight: 'bold',
                      border: 'none'
                    }}
                  />
                </Box>                <CardContent sx={{ 
                  flexGrow: 1, 
                  p: 3, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  height: 'calc(100% - 4px)', // Account for the top border
                  boxSizing: 'border-box'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar 
                      sx={{ 
                        width: 60, 
                        height: 60,
                        background: 'linear-gradient(135deg, #78909c 0%, #90a4ae 100%)',
                        mr: 3,
                        boxShadow: 2,
                        flexShrink: 0
                      }}
                    >
                      <PhotoLibrary sx={{ fontSize: 28, color: 'white' }} />
                    </Avatar>
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <Typography variant="h5" component="h2" fontWeight="bold" sx={{ mb: 1, lineHeight: 1.2 }}>
                        Image Fusion
                      </Typography>
                      <Typography variant="body2" color="text.secondary" fontWeight="medium" sx={{ mb: 1, lineHeight: 1.3 }}>
                        Multi-Reference Synthesis
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ 
                        lineHeight: 1.4, 
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        Upload reference images to analyze themes and styles. Generate new images with similar aesthetics and your desired camera angles and compositions.
                      </Typography>
                    </Box>
                  </Box>                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                      800+ fusions created
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: '#78909c' }}>
                      <Typography variant="body2" fontWeight="medium" sx={{ mr: 1, fontSize: '0.875rem' }}>
                        Get Started
                      </Typography>
                      <ArrowForward sx={{ fontSize: 16 }} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>          </Grid>
        </Grid>      </Container>
    </Box>
  );
};

export default FixedDashboard;
