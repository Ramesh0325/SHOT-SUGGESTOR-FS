import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  Button,
  Paper,
  Chip,
  Avatar,
  Fade,
  Zoom,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton
} from '@mui/material';
import {
  CameraAlt,
  PhotoLibrary,
  AutoAwesome,
  Psychology,
  ViewInAr,
  Timeline,
  ArrowForward,
  CheckCircle,
  Star
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MinimalDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalSessions: 0,
    imagesGenerated: 0
  });

  useEffect(() => {
    // Simulate loading and fetch user stats
    const timer = setTimeout(() => {
      setLoading(false);
      // In a real app, fetch from API
      setStats({
        totalProjects: 5,
        totalSessions: 12,
        imagesGenerated: 47
      });
    }, 1500);    return () => clearTimeout(timer);
  }, []);

  // Fixed features array - icons as functions, not JSX elements
  const features = [
    {
      id: 'shot-suggestion',
      title: 'Shot Suggestion',
      subtitle: 'AI-Powered Cinematography',
      description: 'Get intelligent shot suggestions for your creative projects.',
      iconComponent: CameraAlt,
      gradient: 'linear-gradient(135deg, #455a64 0%, #607d8b 100%)',
      color: '#455a64',
      route: '/shot-suggestor',
      badge: 'Most Popular'
    },
    {
      id: 'image-fusion',
      title: 'Image Fusion',
      subtitle: 'Multi-Reference Synthesis', 
      description: 'Create stunning composite images by combining multiple references.',
      iconComponent: PhotoLibrary,
      gradient: 'linear-gradient(135deg, #78909c 0%, #90a4ae 100%)',
      color: '#78909c',
      route: '/image-fusion',
      badge: 'New Features'
    }
  ];
  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Skeleton variant="rectangular" height={100} sx={{ mb: 2 }} />
          <Grid container spacing={3}>
            {[1, 2, 3].map(item => (
              <Grid item xs={12} md={4} key={item}>
                <Skeleton variant="rectangular" height={200} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    );
  }  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Minimal Dashboard - Step 4 (with features array)
        </Typography>
        <Typography variant="body1">
          Welcome {user?.username || 'User'}! Stats: Projects: {stats.totalProjects}, Sessions: {stats.totalSessions}
        </Typography>
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6">Features Available: {features.length}</Typography>
          {features.map((feature) => {
            const IconComponent = feature.iconComponent;
            return (
              <Box key={feature.id} sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
                <IconComponent sx={{ fontSize: 32, color: feature.color }} />
                <Typography variant="h6">{feature.title}</Typography>
                <Typography variant="body2">{feature.description}</Typography>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <CameraAlt color="primary" />
          <PhotoLibrary color="secondary" />
          <AutoAwesome color="success" />
        </Box>
      </Box>
    </Container>
  );
};

export default MinimalDashboard;
