import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Paper,
  Divider,
  Button,
  CircularProgress,
  Snackbar,
  Alert,
  Avatar,
  Chip
} from '@mui/material';
import { CameraAlt, Refresh, Fullscreen, Download } from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from './contexts/AuthContext';

const ShotOutputPage = ({ shots: propShots, images: propImages, shotLoading, handleGenerateImage }) => {
  const { sessionId } = useParams();
  const location = useLocation();
  const { user } = useAuth();
    const [loading, setLoading] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [sessionData, setSessionData] = useState({
    shots: propShots || location.state?.shotData || [],
    input: location.state?.inputData || {}
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('info');
    useEffect(() => {
    // If we have session ID but no data, load it from the API
    if (sessionId && (!location.state || !location.state.shotData)) {
      fetchSessionData();
    }
  }, [sessionId]);
  
  // Add auto-refresh functionality to ensure images are loaded after navigation
  useEffect(() => {
    // When the component mounts or becomes visible after navigation
    const refreshInterval = setInterval(() => {
      // If we have a session ID, periodically refresh the data
      if (sessionId) {
        fetchSessionData();
      }
    }, 10000); // Refresh every 10 seconds
    
    // Refresh immediately when the component becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId]);
  
  // Handle visibility changes (when user comes back to the tab/page)
  const handleVisibilityChange = () => {
    if (!document.hidden && sessionId) {
      fetchSessionData();
    }
  };
    const fetchSessionData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Try to fetch as filesystem session first, then as database session
      let response;
      try {
        response = await axios.get(`http://localhost:8000/sessions/${sessionId}`, {
          params: { session_type: 'filesystem' },
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        // If not found, try as database session
        response = await axios.get(`http://localhost:8000/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      if (response.data) {
        setSessionData({
          shots: response.data.data.shots || [],
          input: response.data.data.input || {}
        });
      }
      return true; // Successfully fetched data
    } catch (err) {
      console.error('Error fetching session data:', err);
      return false; // Failed to fetch data
    } finally {
      setLoading(false);
    }  };
  
  // Function to generate an image for a shot
  const handleGenerateImageForShot = async (shot, index) => {
    if (!shot) return;
    
    // Set loading state for this specific shot
    const updatedShots = [...sessionData.shots];
    updatedShots[index] = { ...updatedShots[index], isGeneratingImage: true };
    setSessionData({ ...sessionData, shots: updatedShots });
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      // Get the shot description, ensuring we use the correct property
      const shotDescription = shot.description || shot.shot_description;
      if (!shotDescription) {
        throw new Error('Shot description is missing');
      }
      
      formData.append('shot_description', shotDescription);
      formData.append('model_name', sessionData.input?.model_name || 'runwayml/stable-diffusion-v1-5');
      
      // Add session information for persistence - IMPORTANT for making images persist
      if (sessionId) {
        formData.append('session_id', sessionId);
        formData.append('shot_index', index.toString()); // Ensure this is a string
        console.log(`Including session ID ${sessionId} and shot index ${index} for persistence`);
      }
      
      console.log('Sending image generation request with data:', {
        shot_description: shotDescription,
        model_name: sessionData.input?.model_name || 'runwayml/stable-diffusion-v1-5',
        session_id: sessionId,
        shot_index: index
      });

      const response = await axios.post('http://localhost:8000/shots/generate-image', 
        formData, 
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      console.log('Image generation response:', response.data);

      if (response.data && response.data.image_url) {
        // Create a copy of session data with the new image URL
        const updatedShotsWithImage = [...sessionData.shots];
        updatedShotsWithImage[index] = { 
          ...updatedShotsWithImage[index], 
          image_url: response.data.image_url,
          isGeneratingImage: false 
        };
        setSessionData({ ...sessionData, shots: updatedShotsWithImage });
          // Show success notification with persistence info
        const successMessage = sessionId ? 
          'Image generated and saved successfully! It will persist across page refreshes.' : 
          'Image generated successfully!';
          
        setSnackbarMessage(successMessage);
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Update the shot to remove loading state
      const updatedShotsAfterError = [...sessionData.shots];
      updatedShotsAfterError[index] = { 
        ...updatedShotsAfterError[index], 
        isGeneratingImage: false,
        generationError: true
      };
      setSessionData({ ...sessionData, shots: updatedShotsAfterError });
      
      // Show error notification
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to generate image';
      setSnackbarMessage(`Error: ${errorMessage}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };
  
  // If being used as a standalone page and still loading
  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  // If being used as a component with props, render the original component
  if (propShots && propShots.length > 0 && propImages) {
    return (
      <div className="output-section">
        <h3 className="output-title">Shot Suggestions & AI Images</h3>
        <ul className="shot-list">
          {propShots.map((shot, idx) => (
            <li key={idx} className="shot-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div className="shot-title">
                  {shot.name ? `${idx + 1}. ${shot.name}` : `Shot ${idx + 1}`}
                </div>
                <div className="shot-description" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span>{shot.description}</span>
                  {shot.description_telugu && (
                    <span className="shot-description-telugu">{shot.description_telugu}</span>
                  )}
                  {!propImages[idx] && (
                    <button
                      className="generate-btn"
                      onClick={() => handleGenerateImage(shot, idx)}
                      disabled={shotLoading[idx]}
                      style={{ marginLeft: '8px', minWidth: '120px' }}
                    >
                      {shotLoading[idx] ? (
                        <span className="spinner" style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #1976d2', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                      ) : 'Generate Image'}
                    </button>
                  )}
                </div>
              </div>
              <div className="shot-image-container" style={{ flex: 1, maxWidth: 220 }}>
                {propImages[idx] && (
                  <img
                    className="shot-img"
                    src={propImages[idx].startsWith('data:image') ? propImages[idx] : `data:image/png;base64,${propImages[idx]}`}
                    alt={`Shot ${idx + 1}`}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }
  // Otherwise render the standalone page view
  return (
    <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Header Section */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #1a365d 0%, #2a4a6b 100%)',
        color: 'white',
        py: 6,
        mb: 4
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 56, height: 56 }}>
                <CameraAlt sx={{ fontSize: 32 }} />
              </Avatar>
              <Box>
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                  Shot Output
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  AI-generated shot suggestions and visualizations
                </Typography>
              </Box>
            </Box>
            <Button 
              variant="contained"
              startIcon={<Refresh />}
              onClick={() => {
                setLoading(true);
                fetchSessionData().then(() => {
                  setSnackbarMessage('Session data refreshed');
                  setSnackbarSeverity('info');
                  setSnackbarOpen(true);
                });
              }}
              disabled={loading}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                backdropFilter: 'blur(10px)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }
              }}
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pb: 4 }}>
        {/* Scene Description Section */}
        <Paper 
          elevation={0}
          sx={{ 
            p: 4, 
            mb: 4, 
            background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
            border: '1px solid',
            borderColor: 'grey.200',
            borderRadius: 3
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
              <CameraAlt />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                Scene Description
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {sessionData.input?.scene_description || "No description available"}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Shots Section */}
        <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'grey.200', borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
              <CameraAlt />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                Shot Suggestions
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {sessionData.shots?.length || 0} AI-generated shots
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={3}>
            {sessionData.shots && sessionData.shots.length > 0 ? (
              sessionData.shots.map((shot, index) => (
                <Grid item xs={12} key={index}>
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Grid container spacing={2}>
                      {/* Left side: Shot details */}
                      <Grid item xs={12} md={7}>
                        <Typography component="div" variant="h6" gutterBottom>
                          {shot.name || `Shot ${shot.num || shot.shot_number || index + 1}`}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" component="div" sx={{ mt: 1 }}>
                          {shot.description || shot.shot_description}
                        </Typography>
                        {shot.explanation && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" color="primary">Explanation</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {shot.explanation}
                            </Typography>
                          </Box>
                        )}
                        {shot.description_telugu && (
                          <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 1 }}>
                            {shot.description_telugu}
                          </Typography>
                        )}
                        {!shot.image_url && (
                          <Button 
                            variant="outlined" 
                            color="primary" 
                            sx={{ mt: 2 }}
                            disabled={shot.isGeneratingImage}
                            onClick={() => handleGenerateImageForShot(shot, index)}
                          >
                            {shot.isGeneratingImage ? (
                              <>
                                <CircularProgress size={20} sx={{ mr: 1 }} />
                                Generating...
                              </>
                            ) : 'Generate Image'}
                          </Button>
                        )}
                      </Grid>
                      
                      {/* Right side: Shot image if available */}
                      <Grid item xs={12} md={5}>
                        {shot.image_url ? (
                          <Box
                            sx={{
                              height: 260,
                              width: '100%',
                              display: 'flex',
                              justifyContent: 'center',
                              position: 'relative'
                            }}
                          >                            <CardMedia
                              component="img"
                              sx={{ 
                                height: '100%', 
                                objectFit: 'contain',
                                maxWidth: '100%',
                                border: '1px solid #eee',
                                borderRadius: 1,
                                cursor: 'pointer'
                              }}
                              image={shot.image_url || ''}
                              alt={`Shot ${shot.num || shot.shot_number || index + 1}`}
                              onClick={() => setFullscreenImage(shot.image_url)}
                              onError={(e) => {
                                console.error('Shot image failed to load', e);
                                e.target.onerror = null;
                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yNCAyMy45OTloLTI0di0yNGgyNHYyNHptLTEtMjJoLTIydjIwaDIydi0yMHptLTEtMXYyMmgtMjB2LTIyaDIwem0tMiA2aC0xNnYxNGgxNnYtMTR6bS0xMC0yaC0zdjJoM3YtMnoiLz48L3N2Zz4=';
                              }}
                            />
                          </Box>
                        ) : shot.isGeneratingImage ? (
                          <Box 
                            sx={{
                              height: 260,
                              width: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              backgroundColor: '#f5f5f5',
                              borderRadius: 1,
                              border: '1px dashed #ccc'
                            }}
                          >
                            <CircularProgress sx={{ mb: 2 }} />
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                              Generating image...
                              <br />
                              This may take a moment
                            </Typography>
                          </Box>
                        ) : (
                          <Box 
                            sx={{
                              height: 260,
                              width: '100%',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              backgroundColor: '#f5f5f5',
                              borderRadius: 1,
                              border: '1px dashed #ccc'
                            }}
                          >
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                              No image generated
                              <br />
                              Click "Generate Image" to create one
                            </Typography>
                          </Box>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))
          ) : (
            <Grid item xs={12}>
              <Typography>No shot data available</Typography>            </Grid>
          )}          </Box>
        </Paper>

        {/* Feedback Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setSnackbarOpen(false)} 
            severity={snackbarSeverity} 
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
        
        {/* Fullscreen Image Modal */}
        {fullscreenImage && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.9)',
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              cursor: 'pointer'
            }}
            onClick={() => setFullscreenImage(null)}
          >
            <Box 
              sx={{ 
                position: 'absolute', 
                top: 16, 
                right: 16,
                color: 'white',
                fontSize: 24,
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              onClick={() => setFullscreenImage(null)}
            >
              ×
            </Box>
            <Box sx={{ maxWidth: '90%', maxHeight: '90%', overflow: 'auto' }}>
              {fullscreenImage && (
                <img
                  src={fullscreenImage}
                  alt="Full-size shot"
                  style={{ 
                    maxWidth: '100%',
                    maxHeight: '90vh',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    console.error('Image failed to load', e);
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0yNCAyMy45OTloLTI0di0yNGgyNHYyNHptLTEtMjJoLTIydjIwaDIydi0yMHptLTEtMXYyMmgtMjB2LTIyaDIwem0tMiA2aC0xNnYxNGgxNnYtMTR6bS0xMC0yaC0zdjJoM3YtMnoiLz48L3N2Zz4=';
                  }}
                />
              )}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default ShotOutputPage;