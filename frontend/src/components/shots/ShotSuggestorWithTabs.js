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
  Psychology,
  Delete
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
  const [previousSessions, setPreviousSessions] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const { user } = useAuth();  // Load project from URL parameter
  useEffect(() => {
    if (projectIdFromUrl && user) {
      console.log('Loading project from URL with authenticated user:', projectIdFromUrl);
      console.log('User details:', user);
      console.log('Token in localStorage:', localStorage.getItem('token') ? 'Present' : 'Missing');
      loadProjectFromId(projectIdFromUrl);
    } else if (projectIdFromUrl && !user) {
      console.log('Project ID found in URL but user not authenticated yet, waiting...');
      console.log('User state:', user);
      console.log('Token in localStorage:', localStorage.getItem('token') ? 'Present' : 'Missing');
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
      loadPreviousSessions();
      loadLastSessionShots();
    }
  }, [selectedProject]);  const loadPreviousSessions = async () => {
    if (!selectedProject) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No auth token found in localStorage');
        showSnackbar('Please log in to view your sessions', 'warning');
        return;
      }
      
      console.log('Loading previous sessions for project:', selectedProject.id);
      console.log('Using token:', token ? `${token.substring(0, 20)}...` : 'null');
      
      const response = await axios.get(`http://localhost:8000/projects/${selectedProject.id}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Raw sessions response:', response.data);
      
      // Filter shot suggestion sessions (exclude fusion sessions)
      const shotSessions = response.data.filter(session => 
        !session.type?.includes('fusion') && !session.name?.includes('fusion')
      );
      
      console.log('Filtered shot sessions:', shotSessions);
      setPreviousSessions(shotSessions);
      console.log('Previous shot sessions loaded:', shotSessions.length);
      
      if (shotSessions.length > 0) {
        showSnackbar(`Found ${shotSessions.length} previous sessions`, 'success');
      }
    } catch (error) {
      console.error('Error loading previous sessions:', error);
      console.error('Error status:', error.response?.status);
      console.error('Error details:', error.response?.data);
      console.error('Error message:', error.message);
      
      // Show user-friendly error message
      if (error.response?.status === 401) {
        console.log('Authentication failed - redirecting to login');
        showSnackbar('Authentication failed. Please log in again.', 'error');
      } else if (error.response?.status === 404) {
        console.log('Project not found');
        showSnackbar('Project not found', 'warning');
      } else if (error.code === 'ERR_NETWORK') {
        console.log('Network error - backend server may be down');
        showSnackbar('Cannot connect to server. Please check if backend is running.', 'error');
      } else {
        console.log('Unknown error loading sessions');
        showSnackbar('Error loading previous sessions', 'error');
      }
      
      setPreviousSessions([]);
    }
  };

  const loadSessionShots = async (session) => {
    if (!selectedProject || !session) return;

    console.log('Loading shots from session:', session.id);
    setSessionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const detailsResponse = await axios.get(
        `http://localhost:8000/projects/${selectedProject.id}/sessions/${session.id}/details`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (detailsResponse.data.shots_data?.shots) {
        const shotsWithImages = detailsResponse.data.shots_data.shots.map(shot => ({
          ...shot,
          image_url: shot.image_url ? `http://localhost:8000${shot.image_url}` : shot.image_url
        }));
        setShots(shotsWithImages);
        setSessionInfo({ id: session.id, ...detailsResponse.data.session });
        if (detailsResponse.data.input_data?.scene_description) {
          setSceneDescription(detailsResponse.data.input_data.scene_description);
        }
        console.log('Successfully loaded shots from session:', shotsWithImages.length, 'shots with images:', shotsWithImages.filter(s => s.image_url).length);
        showSnackbar(`Loaded ${shotsWithImages.length} shots from session`, 'success');
      }
    } catch (error) {
      console.error('Error loading session shots:', error);
      showSnackbar('Error loading session shots', 'error');
    } finally {
      setSessionLoading(false);
    }
  };

  const loadLastSessionShots = async () => {
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
          const shotsWithImages = detailsResponse.data.shots_data.shots.map(shot => ({
            ...shot,
            image_url: shot.image_url ? `http://localhost:8000${shot.image_url}` : shot.image_url
          }));
          setShots(shotsWithImages);
          setSessionInfo({ id: lastSession.id, ...detailsResponse.data.session });
          if (detailsResponse.data.input_data?.scene_description) {
            setSceneDescription(detailsResponse.data.input_data.scene_description);
          }
          console.log('Successfully loaded previous shots:', shotsWithImages.length, 'with images:', shotsWithImages.filter(s => s.image_url).length);
          // Only show notification if there are actual shots loaded
          if (shotsWithImages.length > 0) {
            showSnackbar(`Loaded ${shotsWithImages.length} previous shots from project`, 'info');
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

  const handleDeleteSession = (session) => {
    console.log('Delete button clicked for session:', session);
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete || !selectedProject) return;

    console.log('Attempting to delete session:', sessionToDelete.id, 'from project:', selectedProject.id);
    const isDeletingCurrentSession = sessionInfo?.id === sessionToDelete.id;
    console.log('Is deleting current session:', isDeletingCurrentSession);
    
    try {
      const token = localStorage.getItem('token');
      console.log('Using token for delete:', token ? 'Present' : 'Missing');
      
      const response = await axios.delete(
        `http://localhost:8000/projects/${selectedProject.id}/sessions/${sessionToDelete.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Delete response:', response.status, response.data);

      // Remove from local state
      setPreviousSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      
      // If we're deleting the current session, clear the UI and load the next available session
      if (isDeletingCurrentSession) {
        console.log('Clearing current session data');
        setShots([]);
        setSessionInfo(null);
        setSceneDescription('');
        
        // After deleting current session, try to load the most recent remaining session
        const remainingSessions = previousSessions.filter(s => s.id !== sessionToDelete.id);
        if (remainingSessions.length > 0) {
          console.log('Loading next available session:', remainingSessions[0].id);
          setTimeout(() => {
            loadSessionShots(remainingSessions[0]);
          }, 500); // Small delay to ensure state is updated
        }
      }

      showSnackbar(
        isDeletingCurrentSession 
          ? 'Current session deleted successfully' 
          : 'Session deleted successfully', 
        'success'
      );
    } catch (error) {
      console.error('Error deleting session:', error);
      console.error('Error details:', error.response?.data);
      showSnackbar(`Error deleting session: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const cancelDeleteSession = () => {
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
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
        
        // Refresh previous sessions to show the new session icon
        await loadPreviousSessions();
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

            {/* Previous Shot Sessions as Icons */}
            {selectedProject && (
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Shot Sessions
                  </Typography>
                  <Button 
                    size="small" 
                    onClick={loadPreviousSessions}
                    variant="outlined"
                  >
                    Refresh
                  </Button>
                </Box>
                
                {previousSessions.length === 0 && shots.length === 0 ? (
                  <Alert severity="info" sx={{ textAlign: 'center' }}>
                    No shot sessions yet. Generate your first shots to get started!
                  </Alert>
                ) : (
                  <Grid container spacing={1}>
                    {/* Show current session as "active" if shots are loaded */}
                    {shots.length > 0 && sessionInfo && (
                      <Grid item xs={6}>
                        <Card 
                          sx={{ 
                            minHeight: 80,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'success.light',
                            color: 'white',
                            border: '2px solid',
                            borderColor: 'success.main',
                            position: 'relative',
                            '&:hover .delete-button': {
                              opacity: 1
                            }
                          }}
                        >
                          {/* Delete Button for Current Session */}
                          <IconButton
                            className="delete-button"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Delete current session clicked');
                              handleDeleteSession(sessionInfo);
                            }}
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              opacity: 1, // Always visible for testing
                              transition: 'opacity 0.2s',
                              color: 'error.main',
                              bgcolor: 'background.paper',
                              '&:hover': {
                                bgcolor: 'error.light',
                                color: 'white'
                              },
                              width: 24,
                              height: 24
                            }}
                          >
                            <Delete sx={{ fontSize: 16 }} />
                          </IconButton>
                          
                          <CardContent sx={{ textAlign: 'center', py: 1 }}>
                            <CameraAlt sx={{ fontSize: 24, mb: 0.5 }} />
                            <Typography variant="caption" fontWeight="bold" display="block">
                              Current Session
                            </Typography>
                            <Typography variant="caption">
                              {shots.length} shots
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    )}
                    
                    {previousSessions.map((session, index) => {
                      const sessionDate = new Date(session.created_at);
                      const timeStamp = sessionDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      
                      const isCurrentSession = sessionInfo?.id === session.id;
                      
                      return (
                        <Grid item xs={6} key={session.id}>
                          <Card 
                            sx={{ 
                              minHeight: 80,
                              display: 'flex',
                              flexDirection: 'column',
                              position: 'relative',
                              border: isCurrentSession ? '2px solid' : '1px solid',
                              borderColor: isCurrentSession ? 'primary.main' : 'divider',
                              bgcolor: isCurrentSession ? 'primary.light' : 'background.paper',
                              color: isCurrentSession ? 'white' : 'text.primary',
                              '&:hover .delete-button': {
                                opacity: 1
                              }
                            }}
                          >
                            {/* Delete Button */}
                            <IconButton
                              className="delete-button"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Delete icon clicked directly');
                                handleDeleteSession(session);
                              }}
                              sx={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                opacity: 1, // Always visible for testing
                                transition: 'opacity 0.2s',
                                color: 'error.main',
                                bgcolor: 'background.paper',
                                '&:hover': {
                                  bgcolor: 'error.light',
                                  color: 'white'
                                },
                                width: 24,
                                height: 24
                              }}
                            >
                              <Delete sx={{ fontSize: 16 }} />
                            </IconButton>

                            {/* Clickable Content */}
                            <Box
                              sx={{
                                cursor: 'pointer',
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                '&:hover': { 
                                  bgcolor: isCurrentSession ? 'primary.dark' : 'action.hover',
                                  transform: 'scale(1.02)',
                                  transition: 'all 0.2s'
                                }
                              }}
                              onClick={() => loadSessionShots(session)}
                            >
                              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                                <CameraAlt sx={{ fontSize: 24, mb: 0.5 }} />
                                <Typography variant="caption" fontWeight="bold" display="block">
                                  Session {index + 1}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: isCurrentSession ? 0.9 : 0.7 }}>
                                  {timeStamp}
                                </Typography>
                              </CardContent>
                            </Box>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </Box>
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
              // Custom layout: 3 shots side by side, otherwise default grid
              shots.length === 3 ? (
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, alignItems: 'stretch', width: '100%' }}>
                  {shots.map((shot, index) => (
                    <Card 
                      key={index}
                      sx={{ 
                        flex: '1 1 0',
                        minWidth: 0,
                        maxWidth: 400,
                        height: '100%',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 6
                        }
                      }}
                      onClick={() => handleShotClick(shot)}
                    >
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
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
                            sx={{ borderRadius: 1, mb: 2, objectFit: 'cover', width: '100%' }}
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
                  ))}
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
              )
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
          mb: 4,
          position: 'relative'
        }}
      >
        {/* Back to Projects button in header when project is selected */}
        {selectedProject && (
          <Box sx={{ 
            position: 'absolute',
            left: { xs: 16, md: 32 },
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 1
          }}>
            <Button
              variant="contained"
              startIcon={<ArrowBack />}
              onClick={handleBackToProjects}
              size="small"
              sx={{ 
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' },
                borderRadius: 2,
                px: 2
              }}
            >
              Projects
            </Button>
          </Box>
        )}
        
        {/* Project info in header when project is selected */}
        {selectedProject && (
          <Box sx={{ 
            position: 'absolute',
            right: { xs: 16, md: 32 },
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            zIndex: 1
          }}>
            <Chip 
              label={selectedProject.name} 
              color="primary" 
              variant="filled"
              sx={{ 
                fontSize: '0.875rem', 
                fontWeight: 'bold',
                bgcolor: 'primary.light',
                color: 'white'
              }}
            />
          </Box>
        )}
        
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

        {/* Delete Session Confirmation Dialog */}
        <Dialog 
          open={deleteDialogOpen} 
          onClose={cancelDeleteSession}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Delete Session
          </DialogTitle>
          <DialogContent>
            {sessionToDelete && sessionInfo?.id === sessionToDelete.id ? (
              <>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <strong>You are about to delete the current active session.</strong>
                </Alert>
                <Typography variant="body1">
                  This will clear your current shots and switch to another session (if available). This action cannot be undone.
                </Typography>
              </>
            ) : (
              <Typography variant="body1">
                Are you sure you want to delete this session? This action cannot be undone.
              </Typography>
            )}
            {sessionToDelete && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Session: {sessionToDelete.name || sessionToDelete.id}
                  {sessionInfo?.id === sessionToDelete.id && (
                    <Chip 
                      label="Current" 
                      size="small" 
                      color="success" 
                      sx={{ ml: 1 }} 
                    />
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Created: {new Date(sessionToDelete.created_at).toLocaleString()}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelDeleteSession} color="inherit">
              Cancel
            </Button>
            <Button 
              onClick={confirmDeleteSession} 
              color="error" 
              variant="contained"
              startIcon={<Delete />}
            >
              Delete
            </Button>
          </DialogActions>
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
