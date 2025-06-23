import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
  Paper,
  CircularProgress,
  Divider,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Chip
} from '@mui/material';
import {
  CameraAlt,
  FolderOpen,
  History,
  ArrowBack,
  Add,
  PhotoCamera,
  Psychology
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import Projects from '../projects/Projects';
import Sessions from '../sessions/Sessions';

const ShotSuggestorWithTabs = () => {
  // URL and navigation
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const projectIdFromUrl = urlParams.get('projectId');

  // State management
  const [currentTab, setCurrentTab] = useState(projectIdFromUrl ? 1 : 0); // Start on Shot Generator if project selected
  const [selectedProject, setSelectedProject] = useState(null);
  const [sceneDescription, setSceneDescription] = useState('');
  const [numShots, setNumShots] = useState(3);
  const [shots, setShots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [imageGenerating, setImageGenerating] = useState({});
  const [sessionInfo, setSessionInfo] = useState(null);
  const [selectedShot, setSelectedShot] = useState(null);
  const [open, setOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const { user } = useAuth();

  // Load project from URL parameter
  useEffect(() => {
    if (projectIdFromUrl) {
      loadProjectFromId(projectIdFromUrl);
    }
  }, [projectIdFromUrl]);

  const loadProjectFromId = async (projectId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedProject(response.data);
      setCurrentTab(1); // Switch to shot generator tab
    } catch (error) {
      console.error('Error loading project:', error);
      showSnackbar('Error loading project', 'error');
    }
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setCurrentTab(1); // Switch to shot generator tab
    // Update URL without page reload
    window.history.pushState({}, '', `/shot-suggestor?projectId=${project.id}`);
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setCurrentTab(0);
    setShots([]);
    setSceneDescription('');
    setSessionInfo(null);
    // Update URL without page reload
    window.history.pushState({}, '', '/shot-suggestor');
  };

  const handleTabChange = (event, newValue) => {
    // Only allow tab change if we have a project or going to projects tab
    if (newValue === 0 || selectedProject) {
      setCurrentTab(newValue);
    }
  };

  const handleNumShotsChange = (event, newValue) => {
    setNumShots(newValue);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const generateShots = async () => {
    if (!sceneDescription.trim()) {
      showSnackbar('Please enter a scene description', 'error');
      return;
    }

    if (!selectedProject) {
      showSnackbar('Please select a project first', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const requestData = {
        scene_description: sceneDescription,
        num_shots: numShots,
        model_name: 'runwayml/stable-diffusion-v1-5'
      };

      const response = await axios.post(
        `http://localhost:8000/shots/suggest?project_id=${selectedProject.id}`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.suggestions) {
        setShots(response.data.suggestions);
        setSessionInfo(response.data.session_info);
        showSnackbar('Shots generated successfully!');
      } else {
        showSnackbar('Failed to generate shots', 'error');
      }
    } catch (error) {
      console.error('Error generating shots:', error);
      if (error.response?.status === 429) {
        showSnackbar('API quota exceeded. Please try again later.', 'error');
      } else if (error.response?.status === 400) {
        showSnackbar('Scene description blocked by safety filters. Please rephrase.', 'error');
      } else {
        showSnackbar('Error generating shots', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const generateImageForShot = async (shot, shotIndex) => {
    setImageGenerating(prev => ({ ...prev, [shotIndex]: true }));
    
    try {
      const formData = new FormData();
      formData.append('shot_description', shot.shot_description);
      formData.append('model_name', 'runwayml/stable-diffusion-v1-5');
      
      if (sessionInfo && selectedProject) {
        formData.append('session_id', sessionInfo.id);
        formData.append('project_id', selectedProject.id);
        formData.append('shot_index', shotIndex.toString());
      }

      const response = await axios.post('http://localhost:8000/shots/generate-image', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.image_url) {
        // Update the shot with the generated image
        setShots(prevShots => 
          prevShots.map((s, index) => 
            index === shotIndex 
              ? { ...s, image_url: response.data.image_url }
              : s
          )
        );
        showSnackbar('Image generated successfully!');
      } else {
        showSnackbar('Failed to generate image', 'error');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      showSnackbar('Error generating image', 'error');
    } finally {
      setImageGenerating(prev => ({ ...prev, [shotIndex]: false }));
    }
  };

  const handleShotClick = (shot) => {
    setSelectedShot(shot);
    setOpen(true);
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 0:
        return (
          <Projects 
            projectType="shot-suggestion" 
            onProjectSelect={handleProjectSelect}
          />
        );
      case 1:
        return renderShotGenerator();
      case 2:
        return <Sessions projectType="shot-suggestion" />;
      default:
        return null;
    }
  };

  const renderShotGenerator = () => (
    <Box sx={{ minHeight: '80vh' }}>
      {/* Project Header */}
      {selectedProject && (
        <Paper sx={{ p: 2, mb: 3, background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton onClick={handleBackToProjects} sx={{ color: 'primary.main' }}>
                <ArrowBack />
              </IconButton>
              <Box>
                <Typography variant="h5" fontWeight="bold" color="primary.main">
                  {selectedProject.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedProject.description || 'No description'}
                </Typography>
              </Box>
            </Box>
            <Chip 
              label="Shot Suggestion Project" 
              color="primary" 
              icon={<CameraAlt />}
              variant="outlined"
            />
          </Box>
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Left Panel - Shot Configuration */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: 'fit-content', position: 'sticky', top: 20 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Psychology color="primary" />
              Scene Configuration
            </Typography>
            
            <TextField
              fullWidth
              label="Scene Description"
              multiline
              rows={4}
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              placeholder="Describe the scene you want to capture..."
              sx={{ mb: 3 }}
            />
            
            <Typography gutterBottom>Number of Shots: {numShots}</Typography>
            <Slider
              value={numShots}
              onChange={handleNumShotsChange}
              valueLabelDisplay="auto"
              step={1}
              marks
              min={1}
              max={6}
              sx={{ mb: 3 }}
            />
            
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={generateShots}
              disabled={isLoading || !selectedProject}
              startIcon={isLoading ? <CircularProgress size={20} /> : <CameraAlt />}
              sx={{ 
                py: 1.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                }
              }}
            >
              {isLoading ? 'Generating...' : 'Generate Shots'}
            </Button>

            {!selectedProject && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Please select a project first to generate shots.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Right Panel - Generated Shots */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, minHeight: '60vh' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PhotoCamera color="primary" />
              Generated Shots
              {shots.length > 0 && (
                <Chip label={`${shots.length} shots`} size="small" color="primary" />
              )}
            </Typography>
            
            {shots.length === 0 ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '50vh',
                textAlign: 'center' 
              }}>
                <CameraAlt sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No shots generated yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter a scene description and click "Generate Shots" to get started
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={3}>
                {shots.map((shot, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Card 
                      sx={{ 
                        height: '100%',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 6
                        }
                      }}
                      onClick={() => handleShotClick(shot)}
                    >
                      <CardContent>
                        <Typography variant="h6" gutterBottom color="primary">
                          Shot {index + 1}: {shot.shot_type}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {shot.shot_description}
                        </Typography>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        {shot.image_url ? (
                          <CardMedia
                            component="img"
                            height="200"
                            image={shot.image_url}
                            alt={`Shot ${index + 1}`}
                            sx={{ borderRadius: 1, mb: 2 }}
                          />
                        ) : (
                          <Box sx={{ 
                            height: 200, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                            mb: 2
                          }}>
                            <Typography variant="body2" color="text.secondary">
                              No image generated
                            </Typography>
                          </Box>
                        )}
                        
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            generateImageForShot(shot, index);
                          }}
                          disabled={imageGenerating[index]}
                          startIcon={imageGenerating[index] ? <CircularProgress size={16} /> : <Add />}
                        >
                          {imageGenerating[index] ? 'Generating...' : 
                           shot.image_url ? 'Regenerate Image' : 'Generate Image'}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      pt: 8
    }}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Paper sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 3
          }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Shot Suggestion Studio
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              Create professional shot suggestions with AI-powered scene analysis
            </Typography>
          </Box>
          
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={currentTab} onChange={handleTabChange} aria-label="shot suggestor tabs">
              <Tab 
                icon={<FolderOpen />} 
                label="Projects" 
                iconPosition="start"
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              />
              <Tab 
                icon={<CameraAlt />} 
                label="Shot Generator" 
                iconPosition="start"
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
                disabled={!selectedProject}
              />
              <Tab 
                icon={<History />} 
                label="Sessions" 
                iconPosition="start"
                sx={{ textTransform: 'none', fontWeight: 'bold' }}
              />
            </Tabs>
          </Box>
        </Paper>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Shot Detail Modal */}
        <Dialog 
          open={open} 
          onClose={() => setOpen(false)}
          maxWidth="md"
          fullWidth
        >
          {selectedShot && (
            <>
              <DialogTitle>
                Shot Details: {selectedShot.shot_type}
              </DialogTitle>
              <DialogContent>
                <Typography variant="body1" paragraph>
                  <strong>Description:</strong> {selectedShot.shot_description}
                </Typography>
                <Typography variant="body1" paragraph>
                  <strong>Technical Details:</strong> {selectedShot.technical_details}
                </Typography>
                <Typography variant="body1" paragraph>
                  <strong>Creative Notes:</strong> {selectedShot.creative_notes}
                </Typography>
                {selectedShot.image_url && (
                  <CardMedia
                    component="img"
                    image={selectedShot.image_url}
                    alt="Generated shot"
                    sx={{ borderRadius: 1, maxHeight: 400, objectFit: 'contain' }}
                  />
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setOpen(false)}>Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default ShotSuggestorWithTabs;
