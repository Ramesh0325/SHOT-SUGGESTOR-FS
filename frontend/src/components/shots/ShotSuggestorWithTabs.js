import React, { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Tooltip
} from '@mui/material';
import {
  CameraAlt,
  FolderOpen,
  ArrowBack,
  Add,
  PhotoCamera,
  Psychology
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import Projects from '../projects/Projects';

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
  const [numShots, setNumShots] = useState(3);  const [shots, setShots] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [imageGenerating, setImageGenerating] = useState({});
  const [sessionInfo, setSessionInfo] = useState(null);
  const [selectedShot, setSelectedShot] = useState(null);
  const [open, setOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const { user } = useAuth();  // Load project from URL parameter
  useEffect(() => {
    if (projectIdFromUrl && user) {
      console.log('Loading project from URL with authenticated user:', projectIdFromUrl);
      loadProjectFromId(projectIdFromUrl);
    } else if (projectIdFromUrl && !user) {
      console.log('Project ID found in URL but user not authenticated yet, waiting...');
    }
  }, [projectIdFromUrl, user]);

  // Debug useEffect to monitor when shots are loaded
  useEffect(() => {
    console.log('Shots state changed:', shots.length, 'shots loaded');
    if (shots.length > 0) {
      console.log('Shots loaded successfully:', shots);
    }
  }, [shots]);

  // Load last session shots when project is selected
  useEffect(() => {
    if (selectedProject) {
      loadLastSessionShots();
    }
  }, [selectedProject]);  const loadLastSessionShots = async () => {
    if (!selectedProject) return;

    console.log('Loading last session shots for project:', selectedProject.id);
    setSessionLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No auth token found, cannot load previous shots');
        setSessionLoading(false);
        return;
      }
      
      console.log('Fetching sessions for project:', selectedProject.id);
      const response = await axios.get(`http://localhost:8000/projects/${selectedProject.id}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Sessions response:', response.data); // Debug log
      
      // Find the most recent shot suggestion session
      const shotSessions = response.data.filter(session => 
        !session.type?.includes('fusion') && !session.name?.includes('fusion')
      );
      
      console.log('Shot sessions found:', shotSessions); // Debug log
      
      if (shotSessions.length > 0) {
        // Sort by created_at and get the most recent
        shotSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const lastSession = shotSessions[0];
        
        console.log('Loading session:', lastSession); // Debug log
        
        // Load the session details
        const detailsResponse = await axios.get(
          `http://localhost:8000/projects/${selectedProject.id}/sessions/${lastSession.id}/details`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log('Session details:', detailsResponse.data); // Debug log
        
        if (detailsResponse.data.shots_data?.shots) {
          setShots(detailsResponse.data.shots_data.shots);
          setSessionInfo({ id: lastSession.id, ...detailsResponse.data.session });
          if (detailsResponse.data.input_data?.scene_description) {
            setSceneDescription(detailsResponse.data.input_data.scene_description);
          }
          console.log('Successfully loaded previous shots:', detailsResponse.data.shots_data.shots.length);
          // Only show notification if there are actual shots loaded
          if (detailsResponse.data.shots_data.shots.length > 0) {
            showSnackbar(`Loaded ${detailsResponse.data.shots_data.shots.length} previous shots from project`, 'info');
          }
        }
      } else {
        console.log('No shot suggestion sessions found for this project'); // Debug log
        // Reset state when no previous sessions found
        setShots([]);
        setSessionInfo(null);
        setSceneDescription('');
      }    } catch (error) {
      console.error('Error loading last session shots:', error);
      if (error.response?.status === 401) {
        console.log('Authentication failed - user may need to log in again');
        showSnackbar('Please log in to access your previous work', 'warning');
      } else if (error.response?.status === 404) {
        console.log('Project or sessions not found');
      } else {
        console.log('Network or server error loading previous shots');
      }
      // Reset state on error
      setShots([]);
      setSessionInfo(null);
      setSceneDescription('');
    } finally {
      setSessionLoading(false);
    }
  };
  const loadProjectFromId = async (projectId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('Cannot load project - no authentication token');
        showSnackbar('Please log in to access your project', 'warning');
        return;
      }
      
      console.log('Loading project with ID:', projectId);
      const response = await axios.get(`http://localhost:8000/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Project loaded successfully:', response.data);
      setSelectedProject(response.data);
      setCurrentTab(1); // Switch to shot generator tab
    } catch (error) {
      console.error('Error loading project:', error);
      if (error.response?.status === 401) {
        showSnackbar('Please log in to access your project', 'warning');
      } else if (error.response?.status === 404) {
        showSnackbar('Project not found', 'error');
      } else {
        showSnackbar('Error loading project', 'error');
      }
    }
  };
  const handleProjectSelect = (project) => {
    console.log('Project selected:', project.name, 'ID:', project.id);
    setSelectedProject(project);
    setCurrentTab(1); // Switch to shot generator tab
    // Update URL without page reload
    window.history.pushState({}, '', `/shot-suggestor?projectId=${project.id}`);
  };const handleBackToProjects = () => {
    console.log('Navigating back to projects - resetting state');
    setSelectedProject(null);
    setCurrentTab(0);
    setShots([]);
    setSceneDescription('');
    setSessionInfo(null);
    setSessionLoading(false);
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
    setOpen(true);  };
  const renderTabContent = () => {
    switch (currentTab) {
      case 0:
        return (
          <Projects 
            projectType="shot-suggestion" 
            onProjectSelect={handleProjectSelect}
            hideHeader={true}
          />
        );
      case 1:
        return renderShotGenerator();
      default:
        return null;
    }
  };const renderShotGenerator = () => (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }}>
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
              {sessionLoading ? (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '50vh',
                textAlign: 'center' 
              }}>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Loading previous work...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Restoring your shots from this project
                </Typography>
              </Box>
            ) : shots.length === 0 ? (
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
            )}          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
  return (
    <Container maxWidth="xl" disableGutters sx={{ p: 0, m: 0 }}>
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
          Shot Suggestion Studio
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.92, fontSize: { xs: 16, md: 22 } }}>
          Create professional shot suggestions with AI-powered scene analysis
        </Typography>
      </Box>
      {!selectedProject ? (
        // Show tabs header only when no project is selected
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Paper sx={{ mb: 3, overflow: 'hidden' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={currentTab} onChange={handleTabChange} aria-label="shot suggestor tabs">
                <Tab 
                  icon={<FolderOpen />} 
                  label="Projects" 
                  iconPosition="start"
                  sx={{ textTransform: 'none', fontWeight: 'bold' }}
                />
                <Tooltip title={selectedProject ? '' : 'Enter into a project to use the Shot Suggestor'} arrow disableHoverListener={!!selectedProject}>
                  <span>
                    <Tab 
                      icon={<CameraAlt />} 
                      label="Shot Generator" 
                      iconPosition="start"
                      sx={{ textTransform: 'none', fontWeight: 'bold' }}
                      disabled={!selectedProject}
                    />
                  </span>
                </Tooltip>
              </Tabs>
            </Box>
          </Paper>

          {/* Tab Content */}
          {renderTabContent()}
        </Container>
      ) : (
        // Full-screen project view
        <Box sx={{ minHeight: '100vh', pt: 8 }}>
          {renderTabContent()}
        </Box>
      )}        {/* Shot Detail Modal */}
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
  );
};

export default ShotSuggestorWithTabs;
