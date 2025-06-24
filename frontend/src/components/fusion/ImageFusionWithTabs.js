import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  AppBar,
  Toolbar,
  IconButton,
  Breadcrumbs,
  Link as MuiLink
} from '@mui/material';
import {
  PhotoLibrary,
  FolderOpen,
  ArrowBack
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Projects from '../projects/Projects';
import ImageFusion from './ImageFusion';

const ImageFusionWithTabs = () => {
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check if projectId is passed via URL params
  useEffect(() => {
    const projectId = searchParams.get('projectId');
    if (projectId) {
      // If project ID is provided, skip to the fusion interface
      setSelectedProject({ id: projectId });
    }
  }, [searchParams]);  const handleProjectSelect = (project) => {
    setSelectedProject(project);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    // Remove projectId from URL if it exists
    navigate('/image-fusion', { replace: true });
  };
  const renderTabContent = () => {
    if (!selectedProject) {
      // Show project management when no project is selected
      return (
        <Projects 
          projectType="image-fusion" 
          onProjectSelect={handleProjectSelect}
          hideHeader={true}
        />
      );
    } else {
      // Show full-screen Image Fusion interface when project is selected
      return (
        <Box sx={{ height: 'calc(100vh - 120px)', overflow: 'auto' }}>
          <ImageFusion projectId={selectedProject.id} />
        </Box>
      );
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with navigation */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          {selectedProject && (
            <IconButton
              edge="start"
              onClick={handleBackToProjects}
              sx={{ mr: 2 }}
            >
              <ArrowBack />
            </IconButton>
          )}
          
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div">
              {selectedProject ? 'Image Fusion Workspace' : 'Image Fusion Projects'}
            </Typography>
            
            {selectedProject && (
              <Breadcrumbs sx={{ mt: 0.5 }}>
                <MuiLink
                  component="button"
                  variant="body2"
                  onClick={handleBackToProjects}
                  sx={{ textDecoration: 'none' }}
                >
                  Projects
                </MuiLink>
                <Typography variant="body2" color="text.primary">
                  {selectedProject.name || `Project ${selectedProject.id.slice(0, 8)}`}
                </Typography>
              </Breadcrumbs>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      {/* Custom Studio Header for Project Selection */}
      {!selectedProject && (
        <Box
          sx={{
            width: '100vw',
            minHeight: { xs: 100, md: 140 },
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: { xs: 3, md: 5 },
            px: 2,
            textAlign: 'center',
            boxShadow: 1,
            borderBottomLeftRadius: { xs: 16, md: 32 },
            borderBottomRightRadius: { xs: 16, md: 32 },
            mb: 4
          }}
        >
          <Typography variant="h3" fontWeight="bold" sx={{ mb: 1, fontSize: { xs: 28, md: 40 } }}>
            Image Fusion Studio
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.92, fontSize: { xs: 16, md: 22 } }}>
            Create new perspectives and blend reference images with AI-powered fusion.
          </Typography>
        </Box>
      )}
      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {renderTabContent()}
      </Box>
    </Box>
  );
};

export default ImageFusionWithTabs;
