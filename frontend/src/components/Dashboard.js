import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  Paper,
  Container,
  Chip
} from '@mui/material';
import {
  CameraAlt,
  PhotoLibrary,
  AutoAwesome,
  Psychology
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const features = [
    {
      id: 'shot-suggestion',
      title: 'Shot Suggestion',
      description: 'Get AI-powered shot suggestions for your creative projects. Describe your scene and receive detailed shot recommendations with camera angles, lighting, and composition tips.',
      icon: <CameraAlt sx={{ fontSize: 60, color: 'primary.main' }} />,
      color: '#1976d2',
      features: [
        'Scene analysis and shot recommendations',
        'Camera angle suggestions',
        'Lighting and composition guidance',
        'Professional cinematography tips',
        'Project-based organization'
      ],
      route: '/shot-suggestor'
    },
    {
      id: 'image-fusion',
      title: 'Image Fusion',
      description: 'Create stunning composite images by combining multiple reference photos with your creative vision. Upload several images and describe your desired result to generate a unique fused image.',
      icon: <PhotoLibrary sx={{ fontSize: 60, color: 'secondary.main' }} />,
      color: '#dc004e',
      features: [
        'Multi-image reference upload',
        'AI-powered image fusion',
        'Custom prompt integration',
        'Advanced generation settings',
        'High-quality output'
      ],
      route: '/image-fusion'
    }
  ];

  const handleFeatureClick = (route) => {
    navigate(route);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Welcome to SHOT-SUGGESTOR
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          Your AI-powered creative companion for shot suggestions and image fusion
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Chip 
            icon={<AutoAwesome />} 
            label="AI-Powered" 
            color="primary" 
            variant="outlined" 
          />
          <Chip 
            icon={<Psychology />} 
            label="Creative Intelligence" 
            color="secondary" 
            variant="outlined" 
          />
        </Box>
      </Box>

      <Grid container spacing={4}>
        {features.map((feature) => (
          <Grid item xs={12} md={6} key={feature.id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
              onClick={() => handleFeatureClick(feature.id === 'shot-suggestion' ? '/projects' : feature.route)}
            >
              <Box sx={{ p: 3, textAlign: 'center', bgcolor: `${feature.color}10` }}>
                {feature.icon}
              </Box>
              
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  {feature.title}
                </Typography>
                
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  {feature.description}
                </Typography>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Key Features:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, m: 0 }}>
                    {feature.features.map((feat, index) => (
                      <Typography 
                        key={index} 
                        component="li" 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ mb: 0.5 }}
                      >
                        {feat}
                      </Typography>
                    ))}
                  </Box>
                </Box>

                <Button 
                  variant="contained" 
                  fullWidth
                  size="large"
                  sx={{ 
                    bgcolor: feature.color,
                    '&:hover': {
                      bgcolor: feature.color,
                      opacity: 0.9
                    }
                  }}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Additional Info Section */}
      <Paper sx={{ mt: 6, p: 4, bgcolor: 'grey.50' }}>
        <Typography variant="h5" gutterBottom>
          How It Works
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                1. Choose Your Tool
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select between Shot Suggestion for cinematography guidance or Image Fusion for creative image generation.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                2. Provide Input
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Describe your vision, upload reference images, and customize settings to match your creative needs.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                3. Get Results
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Receive AI-generated suggestions or fused images that bring your creative vision to life.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default Dashboard; 