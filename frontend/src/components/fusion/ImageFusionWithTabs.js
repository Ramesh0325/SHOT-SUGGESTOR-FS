import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  AppBar,
  Toolbar,
  IconButton,
  Breadcrumbs,
  Link as MuiLink
} from '@mui/material';
import {
  PhotoLibrary,
  FolderOpen,
  History,
  ArrowBack
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Projects from '../projects/Projects';
import Sessions from '../sessions/SessionsSimple';
import ImageFusion from './ImageFusion';

const ImageFusionWithTabs = () => {
  const [currentTab, setCurrentTab] = useState(0);
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
      setCurrentTab(0); // Go to fusion tab
    }
  }, [searchParams]);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setCurrentTab(0); // Switch to the Image Fusion tab when a project is selected
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setCurrentTab(0); // Go back to projects tab
    // Remove projectId from URL if it exists
    navigate('/image-fusion', { replace: true });
  };

  const renderTabContent = () => {
    if (!selectedProject) {
      // Show project management when no project is selected
      switch (currentTab) {
        case 0:
          return (
            <Projects 
              projectType="image-fusion" 
              onProjectSelect={handleProjectSelect}
            />
          );
        case 1:
          return <Sessions projectType="image-fusion" />;
        default:
          return (
            <Projects 
              projectType="image-fusion" 
              onProjectSelect={handleProjectSelect}
            />
          );
      }
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

      {/* Tabs (only show when no project is selected) */}
      {!selectedProject && (
        <AppBar position="static" color="transparent" elevation={0}>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              icon={<FolderOpen />}
              label="Projects"
              iconPosition="start"
            />
            <Tab
              icon={<History />}
              label="Sessions"
              iconPosition="start"
            />
          </Tabs>
        </AppBar>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {renderTabContent()}
      </Box>
    </Box>
  );
};

export default ImageFusionWithTabs;
