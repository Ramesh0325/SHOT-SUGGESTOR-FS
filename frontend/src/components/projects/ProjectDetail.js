import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Paper,
  Divider,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Tooltip,
  LinearProgress,
  Alert,
  DialogContentText,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import NoPhotographyIcon from '@mui/icons-material/NoPhotography';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [shots, setShots] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shotsLoading, setShotsLoading] = useState(true);
  const [suggestedShots, setSuggestedShots] = useState([]);
  const [loadingShots, setLoadingShots] = useState({});
  const [newShot, setNewShot] = useState({
    scene_description: '',
    num_shots: 5,
    model_name: 'runwayml/stable-diffusion-v1-5'
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingStatus, setLoadingStatus] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingError, setLoadingError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shotToDelete, setShotToDelete] = useState(null);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [currentGenerationShots, setCurrentGenerationShots] = useState([]);
  const [showVersions, setShowVersions] = useState({});
  const [shotVersions, setShotVersions] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        setLoading(true);
        setShotsLoading(true);
        await Promise.all([fetchProjectDetails(), fetchProjectShots()]);
      } catch (err) {
        setError(err.message || 'Failed to load project details');
      } finally {
        setLoading(false);
        setShotsLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProject(response.data);
    } catch (error) {
      console.error('Error fetching project details:', error);
      throw new Error(error.response?.data?.detail || 'Failed to fetch project details');
    }
  };

  const fetchProjectShots = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/projects/${projectId}/shots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShots(response.data);
    } catch (error) {
      console.error('Error fetching project shots:', error);
      throw new Error(error.response?.data?.detail || 'Failed to fetch project shots');
    }
  };

  const handleSuggestShots = async () => {
    if (!newShot.scene_description.trim()) {
      setError("Please enter a scene description");
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestedShots([]);
    setCurrentGenerationShots([]);
    setLoadingStatus('Analyzing scene description...');
    setLoadingProgress(10);
    setLoadingError(null);

    try {
      const token = localStorage.getItem('token');
      setLoadingStatus('Generating shot suggestions...');
      setLoadingProgress(30);
      
      // Get shot suggestions only (do not save to backend)
      const response = await axios.post(
        "http://localhost:8000/shots/suggest",
        {
          scene_description: newShot.scene_description,
          num_shots: newShot.num_shots,
          model_name: newShot.model_name
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && Array.isArray(response.data)) {
        setLoadingStatus('Processing suggestions...');
        setLoadingProgress(60);
        setSuggestedShots(response.data);
        setCurrentGenerationShots([]); // No saving, so no current generation shots
        setLoadingStatus('Finalizing...');
        setLoadingProgress(90);
        setOpen(false);
        setNewShot({
          scene_description: '',
          num_shots: 5,
          model_name: 'runwayml/stable-diffusion-v1-5'
        });
        setLoadingProgress(100);
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (error) {
      console.error("Error suggesting shots:", error);
      let errorMessage = "Failed to generate shots. Please try again.";
      if (error.response) {
        console.error('Error response:', error.response.data);
        if (error.response.status === 429) {
          const retryMatch = error.response.data?.detail?.match(/retry_delay\s*{\s*seconds:\s*(\d+)\s*}/);
          const retryAfter = retryMatch ? parseInt(retryMatch[1]) : 60;
          errorMessage = `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`;
          setLoadingError({
            message: errorMessage,
            retryAfter,
            type: 'rate_limit'
          });
        } else if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
          setLoadingError({
            message: errorMessage,
            type: 'error'
          });
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingStatus('');
      setLoadingProgress(0);
    }
  };

  const handleGenerateImage = async (shot) => {
    try {
      // Set loading state for this specific shot
      setLoadingShots(prev => ({ ...prev, [shot.id]: true }));
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Create FormData and append fields
      const formData = new FormData();
      formData.append('shot_description', shot.shot_description);
      formData.append('model_name', shot.model_name);
      formData.append('shot_id', shot.id);

      console.log('Generating image for shot:', shot.id);
      const response = await axios.post(
        'http://localhost:8000/shots/generate-image',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json'
          },
          withCredentials: true
        }
      );

      console.log('Image generation response:', response.data);

      if (response.data && response.data.image_url) {
        // Update the current generation shots state
        setCurrentGenerationShots(prevShots => 
          prevShots.map(s => 
            s.id === shot.id 
              ? { ...s, image_url: response.data.image_url, version_number: (s.version_number || 1) + 1 }
              : s
          )
        );

        // Fetch shot versions
        const versionsResponse = await axios.get(
          `http://localhost:8000/shots/${shot.id}/versions`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          }
        );

        if (versionsResponse.data) {
          setShotVersions(prev => ({
            ...prev,
            [shot.id]: versionsResponse.data
          }));
        }
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      } else if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to generate image. Please try again.');
      }
    } finally {
      setLoadingShots(prev => ({ ...prev, [shot.id]: false }));
    }
  };

  const handleShowVersions = async (shotId) => {
    if (showVersions[shotId]) {
      setShowVersions(prev => ({ ...prev, [shotId]: false }));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:8000/shots/${shotId}/versions`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (response.data) {
        setShotVersions(prev => ({
          ...prev,
          [shotId]: response.data
        }));
        setShowVersions(prev => ({ ...prev, [shotId]: true }));
      }
    } catch (error) {
      console.error('Error fetching shot versions:', error);
      setError('Failed to fetch shot versions');
    }
  };

  const handleDeleteClick = (shot) => {
    setShotToDelete(shot);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!shotToDelete) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('Deleting shot:', shotToDelete.id);
      const response = await axios.delete(
        `http://localhost:8000/shots/${shotToDelete.id}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        }
      );

      console.log('Delete response:', response.data);

      if (response.data && response.data.message === "Shot deleted successfully") {
        // Update the shots state immediately
        setShots(prevShots => {
          // Remove the deleted shot
          const updatedShots = prevShots.filter(shot => shot.id !== shotToDelete.id);
          // Reorder remaining shots to maintain sequential numbering
          return updatedShots.map((shot, index) => ({
            ...shot,
            shot_number: index + 1
          }));
        });
      } else {
        throw new Error(response.data?.detail || 'Unexpected response from server');
      }
    } catch (error) {
      console.error('Error deleting shot:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        
        if (error.response.status === 401) {
          alert('Your session has expired. Please log in again.');
        } else if (error.response.status === 403) {
          alert('You are not authorized to delete this shot.');
        } else if (error.response.status === 404) {
          alert('Shot not found. It may have been already deleted.');
        } else if (error.response.status === 500) {
          alert(`Server error: ${error.response.data?.detail || 'Failed to delete shot'}`);
        } else {
          alert(`Failed to delete shot: ${error.response.data?.detail || 'Unknown error'}`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
        alert('No response from server. Please check your connection.');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', error.message);
        alert(`Error: ${error.message}`);
      }
    } finally {
      setDeleteDialogOpen(false);
      setShotToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setShotToDelete(null);
  };

  // Add a useEffect to update shot numbers when shots array changes
  useEffect(() => {
    // Update shot numbers whenever shots array changes
    setShots(prevShots => 
      prevShots.map((shot, index) => ({
        ...shot,
        shot_number: index + 1
      }))
    );
  }, [shots.length]); // Only run when number of shots changes

  const handleDeleteProjectClick = () => {
    setProjectToDelete(project);
    setDeleteProjectDialogOpen(true);
  };

  const handleDeleteProjectConfirm = async () => {
    if (!projectToDelete) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      console.log('Deleting project:', projectToDelete.id);
      const response = await axios.delete(
        `http://localhost:8000/projects/${projectToDelete.id}`,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          withCredentials: true
        }
      );

      console.log('Delete project response:', response.data);

      if (response.data && response.data.message === "Project deleted successfully") {
        // Navigate back to projects list
        navigate('/projects');
      } else {
        console.error('Unexpected response:', response.data);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        
        if (error.response.status === 401) {
          // Handle session expiry silently
          navigate('/login');
        } else if (error.response.status === 403) {
          // Handle unauthorized silently
          navigate('/projects');
        } else if (error.response.status === 404) {
          // Handle not found silently
          navigate('/projects');
        } else if (error.response.status === 500) {
          console.error('Server error:', error.response.data?.detail || 'Failed to delete project');
          navigate('/projects');
        } else {
          console.error('Failed to delete project:', error.response.data?.detail || 'Unknown error');
          navigate('/projects');
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
        navigate('/projects');
      } else {
        console.error('Error setting up request:', error.message);
        navigate('/projects');
      }
    } finally {
      setDeleteProjectDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h5" color="error" gutterBottom>
            Error Loading Project
          </Typography>
          <Typography color="text.secondary" paragraph>
            {error}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/projects')}
            sx={{ mt: 2 }}
          >
            Back to Projects
          </Button>
        </Box>
      </Container>
    );
  }

  if (!project) {
    return (
      <Container>
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Typography variant="h5" color="error" gutterBottom>
            Project Not Found
          </Typography>
          <Typography color="text.secondary" paragraph>
            The project you're looking for doesn't exist or you don't have access to it.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/projects')}
            sx={{ mt: 2 }}
          >
            Back to Projects
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Project Header */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            onClick={() => navigate('/projects')}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" component="h1">
              {project.name}
            </Typography>
            <Typography variant="body1" color="textSecondary">
              {project.description || 'No description provided'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setOpen(true)}
            >
              Suggest New Shots
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleDeleteProjectClick}
            >
              Delete Project
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Shot Suggestion Form Dialog */}
      <Dialog 
        open={open} 
        onClose={() => !loading && setOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>Suggest New Shots</DialogTitle>
        <DialogContent>
          {loadingError && (
            <Alert 
              severity={loadingError.type === 'rate_limit' ? 'warning' : 'error'}
              sx={{ mb: 2 }}
            >
              {loadingError.message}
              {loadingError.type === 'rate_limit' && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Retrying in {loadingError.retryAfter} seconds...
                </Typography>
              )}
            </Alert>
          )}
          
          {loading && (
            <Box sx={{ width: '100%', mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {loadingStatus}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={loadingProgress} 
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          )}

          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                autoFocus
                label="Scene Description"
                fullWidth
                multiline
                rows={4}
                required
                value={newShot.scene_description}
                onChange={(e) => setNewShot({ ...newShot, scene_description: e.target.value })}
                error={!newShot.scene_description}
                helperText={!newShot.scene_description ? 'Scene description is required' : ''}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography gutterBottom>Number of Shots</Typography>
              <Slider
                value={newShot.num_shots}
                onChange={(e, value) => setNewShot({ ...newShot, num_shots: value })}
                min={1}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
              <Typography variant="body2" color="text.secondary" align="center">
                {newShot.num_shots} shots
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  value={newShot.model_name}
                  onChange={(e) => setNewShot({ ...newShot, model_name: e.target.value })}
                  label="Model"
                >
                  <MenuItem value="runwayml/stable-diffusion-v1-5">Stable Diffusion v1.5</MenuItem>
                  <MenuItem value="stabilityai/stable-diffusion-2-1">Stable Diffusion v2.1</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {/* Suggested Shots – new minimal UI (below the Grid) */}
          {suggestedShots.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Suggested Shots</Typography>
              {suggestedShots.map(( shot, index ) => (
                <Card key={index} sx={{ mb: 2, p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Shot { shot.shot_number } ( { shot.metadata?.camera_angle || "N/A" } )
                  </Typography>
                  <Typography variant="body2" paragraph>
                    { shot.description || shot.explanation || "No explanation provided." }
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => handleGenerateImage( shot )}
                    disabled={ loadingShots[ shot.id ] }
                  >
                    { loadingShots[ shot.id ] ? "Generating..." : "Generate Image" }
                  </ Button>
                </ Card>
              ))}
            </ Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpen(false)} 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSuggestShots} 
            color="primary"
            disabled={loading || !newShot.scene_description}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Generating...' : 'Generate Shots'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Shot {shotToDelete?.shot_number}?
        </DialogTitle>
        <DialogContent>
          <Typography id="delete-dialog-description">
            Are you sure you want to delete this shot? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Project Deletion Confirmation Dialog */}
      <Dialog
        open={deleteProjectDialogOpen}
        onClose={() => setDeleteProjectDialogOpen(false)}
        aria-labelledby="delete-project-dialog-title"
      >
        <DialogTitle id="delete-project-dialog-title">
          Delete Project
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this project? This will also delete all shots in the project. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProjectDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteProjectConfirm} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Current Generation Shots */}
      {currentGenerationShots.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Current Generation
          </Typography>
          <Grid container spacing={3}>
            {currentGenerationShots.map((shot) => (
              <Grid item xs={12} sm={6} md={4} key={shot.id}>
                <Card>
                  <Box sx={{ position: 'relative' }}>
                    {shot.image_url ? (
                      <CardMedia
                        component="img"
                        height="200"
                        image={shot.image_url}
                        alt={`Shot ${shot.shot_number} (v${shot.version_number})`}
                        sx={{ 
                          objectFit: 'cover',
                          width: '100%',
                          height: '200px',
                          bgcolor: 'grey.100'
                        }}
                        onError={(e) => {
                          console.error('Error loading image:', e);
                          e.target.src = ''; // Clear the src to show the fallback
                          e.target.onerror = null; // Prevent infinite loop
                        }}
                      />
                    ) : (
                      <Box sx={{ 
                        height: 200, 
                        bgcolor: 'grey.200', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        position: 'relative'
                      }}>
                        {loadingShots[shot.id] ? (
                          <Box sx={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(0,0,0,0.1)'
                          }}>
                            <CircularProgress size={40} />
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Generating image...
                            </Typography>
                          </Box>
                        ) : (
                          <NoPhotographyIcon sx={{ fontSize: 60, color: 'grey.400' }} />
                        )}
                      </Box>
                    )}
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 8, 
                      right: 8, 
                      bgcolor: 'rgba(0,0,0,0.5)',
                      borderRadius: '50%',
                      '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.7)'
                      }
                    }}>
                      <Tooltip title="Delete shot">
                        <IconButton 
                          onClick={() => handleDeleteClick(shot)}
                          sx={{ color: 'white' }}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Shot {shot.shot_number} (v{shot.version_number})
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {shot.shot_description}
                    </Typography>
                    {shot.metadata && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="textSecondary">
                          Camera: {shot.metadata.camera_angle} | {shot.metadata.camera_movement}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" display="block">
                          Framing: {shot.metadata.framing}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="contained"
                        onClick={() => handleGenerateImage(shot)}
                        disabled={loadingShots[shot.id]}
                        fullWidth
                      >
                        {loadingShots[shot.id] ? 'Generating...' : 'Generate Image'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => handleShowVersions(shot.id)}
                        fullWidth
                        sx={{ mt: 1 }}
                      >
                        {showVersions[shot.id] ? 'Hide Versions' : 'Show Versions'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {/* Previous Shots */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Previous Shots
        </Typography>
        <Grid container spacing={3}>
          {shots.filter(shot => !currentGenerationShots.find(s => s.id === shot.id)).map((shot) => (
            <Grid item xs={12} sm={6} md={4} key={shot.id}>
              <Card>
                <Box sx={{ position: 'relative' }}>
                  {shot.image_url ? (
                    <CardMedia
                      component="img"
                      height="200"
                      image={shot.image_url}
                      alt={`Shot ${shot.shot_number} (v${shot.version_number || 1})`}
                      sx={{ 
                        objectFit: 'cover',
                        width: '100%',
                        height: '200px',
                        bgcolor: 'grey.100'
                      }}
                      onError={(e) => {
                        console.error('Error loading image:', e);
                        e.target.src = ''; // Clear the src to show the fallback
                        e.target.onerror = null; // Prevent infinite loop
                      }}
                    />
                  ) : (
                    <Box sx={{ 
                      height: 200, 
                      bgcolor: 'grey.200', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      {loadingShots[shot.id] ? (
                        <Box sx={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'rgba(0,0,0,0.1)'
                        }}>
                          <CircularProgress size={40} />
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            Generating image...
                          </Typography>
                        </Box>
                      ) : (
                        <NoPhotographyIcon sx={{ fontSize: 60, color: 'grey.400' }} />
                      )}
                    </Box>
                  )}
                  <Box sx={{ 
                    position: 'absolute', 
                    top: 8, 
                    right: 8, 
                    bgcolor: 'rgba(0,0,0,0.5)',
                    borderRadius: '50%',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.7)'
                    }
                  }}>
                    <Tooltip title="Delete shot">
                      <IconButton 
                        onClick={() => handleDeleteClick(shot)}
                        sx={{ color: 'white' }}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Shot {shot.shot_number} (v{shot.version_number || 1})
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {shot.shot_description}
                  </Typography>
                  {shot.metadata && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        Camera: {shot.metadata.camera_angle} | {shot.metadata.camera_movement}
                      </Typography>
                      <Typography variant="caption" color="textSecondary" display="block">
                        Framing: {shot.metadata.framing}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={() => handleGenerateImage(shot)}
                      disabled={loadingShots[shot.id]}
                      fullWidth
                    >
                      {loadingShots[shot.id] ? 'Generating...' : 'Generate Image'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => handleShowVersions(shot.id)}
                      fullWidth
                      sx={{ mt: 1 }}
                    >
                      {showVersions[shot.id] ? 'Hide Versions' : 'Show Versions'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
              {/* Version History Dialog */}
              {showVersions[shot.id] && shotVersions[shot.id] && (
                <Dialog
                  open={showVersions[shot.id]}
                  onClose={() => setShowVersions(prev => ({ ...prev, [shot.id]: false }))}
                  maxWidth="md"
                  fullWidth
                >
                  <DialogTitle>
                    Version History - Shot {shot.shot_number}
                  </DialogTitle>
                  <DialogContent>
                    <List>
                      {shotVersions[shot.id].map((version) => (
                        <ListItem key={version.id}>
                          <ListItemText
                            primary={`Version ${version.version_number}`}
                            secondary={
                              <>
                                <Typography variant="body2">
                                  {version.shot_description}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  Created: {new Date(version.created_at).toLocaleString()}
                                </Typography>
                              </>
                            }
                          />
                          {version.image_url && (
                            <Box sx={{ ml: 2 }}>
                              <img
                                src={version.image_url}
                                alt={`Version ${version.version_number}`}
                                style={{ width: 100, height: 100, objectFit: 'cover' }}
                              />
                            </Box>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setShowVersions(prev => ({ ...prev, [shot.id]: false }))}>
                      Close
                    </Button>
                  </DialogActions>
                </Dialog>
              )}
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Container>
  );
};

export default ProjectDetail; 