import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardMedia,
  IconButton,
  TextField,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Container
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Download,
  Clear,
  AutoAwesome,  Help,
  ExpandMore,
  ExpandLess,
  PhotoCamera,
  Psychology,
  CameraAlt
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PsychologyIcon from '@mui/icons-material/Psychology';
import DeleteIcon from '@mui/icons-material/Delete';

const ImageFusion = ({ projectId }) => {
  const auth = useAuth();
  const token = auth?.token;
  const [referenceImages, setReferenceImages] = useState([]);
  const [imageAnalyses, setImageAnalyses] = useState([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState(new Set());
  const [combinedPrompt, setCombinedPrompt] = useState('');
  const [combinedPromptData, setCombinedPromptData] = useState(null);
  const [promptPreviewLoading, setPromptPreviewLoading] = useState(false);  const [showCombinedPrompt, setShowCombinedPrompt] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [prompt, setPrompt] = useState('');  const [finalPrompt, setFinalPrompt] = useState('');
  const [showFinalPrompt, setShowFinalPrompt] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [currentGeneratedImage, setCurrentGeneratedImage] = useState(null);
  const [error, setError] = useState('');
  const [fusionLoading, setFusionLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const fileInputRef = useRef();
  const [fusionSession, setFusionSession] = useState(null);
  const [fusionSessions, setFusionSessions] = useState([]);
  const [fusionSessionsLoading, setFusionSessionsLoading] = useState(false);
  const [fusionSessionsError, setFusionSessionsError] = useState('');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  // Load all fusion sessions for this project
  useEffect(() => {
    if (projectId && token) {
      setFusionSessionsLoading(true);
      setFusionSessionsError('');
      fetch(`http://localhost:8000/projects/${projectId}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const fusions = (data || []).filter(
            session => session.type?.includes('fusion') || session.name?.includes('fusion')
          );
          setFusionSessions(fusions);
          setFusionSessionsLoading(false);
        })
        .catch(err => {
          setFusionSessionsError('Failed to load fusion sessions');
          setFusionSessionsLoading(false);
        });
    }
  }, [projectId, token, fusionSession]); // reload when session changes

  const loadLastFusionSession = async () => {
    try {
      const response = await fetch(`http://localhost:8000/projects/${projectId}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const sessions = await response.json();
        
        // Find the most recent fusion session
        const fusionSessions = sessions.filter(session => 
          session.type?.includes('fusion') || session.name?.includes('fusion')
        );
        
        if (fusionSessions.length > 0) {
          // Sort by created_at and get the most recent
          fusionSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          const lastSession = fusionSessions[0];
          
          // Load the session details
          const detailsResponse = await fetch(
            `http://localhost:8000/projects/${projectId}/sessions/${lastSession.id}/details`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
            if (detailsResponse.ok) {
            const sessionData = await detailsResponse.json();
            
            // Restore fusion session state
            if (sessionData.input_data?.final_prompt) {
              setPrompt(sessionData.input_data.final_prompt);
              setFinalPrompt(sessionData.input_data.final_prompt);
            }
            
            // Load generated images from session
            if (sessionData.image_files && sessionData.image_files.length > 0) {
              const fusionImages = sessionData.image_files.map((imageFile, index) => ({
                id: `fusion_${Date.now()}_${index}`,
                image_url: `http://localhost:8000${imageFile.url}`,
                prompt: sessionData.input_data?.final_prompt || sessionData.output_data?.final_prompt || 'Fusion image',
                timestamp: sessionData.session?.created_at ? new Date(sessionData.session.created_at).toLocaleString() : 'Unknown'
              }));
              
              setGeneratedImages(fusionImages);
              if (fusionImages.length > 0) {
                setCurrentGeneratedImage(fusionImages[0]);
              }
              
              console.log(`Loaded ${fusionImages.length} fusion images from session`);
            }
            
            // Restore other session data if available
            if (sessionData.output_data?.final_prompt) {
              setFinalPrompt(sessionData.output_data.final_prompt);
              setShowFinalPrompt(true);
            }
            
            console.log('Loaded previous fusion session:', sessionData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading last fusion session:', error);
      // Don't show error to user as this is a background operation
    }
  };

  const handleImageUpload = async (event) => {
    // Always start a new fusion session if one is not active
    if (!fusionSession && startFusionSession) {
      const session = await startFusionSession();
      if (session) setFusionSession(session);
    }
    const files = Array.from(event.target.files);
    const newImages = files.map(file => ({
      file,
      name: file.name,
      preview: URL.createObjectURL(file)
    }));
    setReferenceImages(prev => [...prev, ...newImages]);
    setError('');    // Reset all analysis and prompt state when new images are uploaded
    setImageAnalyses([]);
    setAnalysisComplete(false);
    setCombinedPrompt('');
    setCombinedPromptData(null);
    setShowCombinedPrompt(false);
    setShowFinalPrompt(false);
    setFinalPrompt('');
    setGeneratedImages([]);
    setCurrentGeneratedImage(null);
    setCurrentStep(1);
  };

  const removeImage = (index) => {
    setReferenceImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      return newImages;
    });    // Reset all analysis and prompt state when images are removed
    setImageAnalyses([]);
    setAnalysisComplete(false);
    setCombinedPrompt('');
    setCombinedPromptData(null);
    setShowCombinedPrompt(false);
    setShowFinalPrompt(false);
    setFinalPrompt('');
    setGeneratedImages([]);
    setCurrentGeneratedImage(null);
    setCurrentStep(1);
  };

  const handlePreviewImage = (image) => {
    setPreviewImage(image);
    setPreviewOpen(true);
  };

  const handleAnalyzeImages = async () => {
    if (!fusionSession) {
      const session = await startFusionSession();
      if (!session) return;
    }

    if (referenceImages.length === 0) {
      setError('Please upload at least one reference image');
      return;
    }

    setAnalysisLoading(true);
    setError('');

    try {
      const formData = new FormData();
      
      // Add all reference images
      referenceImages.forEach((imageObj) => {
        formData.append('files', imageObj.file);
      });

      const response = await fetch('http://localhost:8000/api/analyze-images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze images');
      }

      const data = await response.json();
      setImageAnalyses(data.analyses);
      setAnalysisComplete(true);
      setCurrentStep(3); // Move to prompt entry step
      
      // Show success message
      if (data.summary.failed_analyses > 0) {
        setError(`Analysis completed with ${data.summary.failed_analyses} failed images. See details below.`);
      }

    } catch (err) {
      setError(err.message);
      setAnalysisComplete(false);
    } finally {
      setAnalysisLoading(false);
    }
  };
  const handlePreviewCombinedPrompt = async () => {
    if (!prompt.trim()) {
      setError('Please enter your desired angle/viewpoint prompt');
      return;
    }

    if (!analysisComplete || imageAnalyses.length === 0) {
      setError('Please analyze your images first');
      return;
    }

    setPromptPreviewLoading(true);
    setError('');

    try {
      // Extract successful descriptions
      const successfulDescriptions = imageAnalyses
        .filter(analysis => analysis.status === 'success')
        .map(analysis => analysis.description);

      if (successfulDescriptions.length === 0) {
        setError('No successful image analyses found to combine with your prompt');
        return;
      }

      const formData = new FormData();
      formData.append('user_prompt', prompt);
      formData.append('image_descriptions', JSON.stringify(successfulDescriptions));

      const response = await fetch('http://localhost:8000/api/preview-combined-prompt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to preview combined prompt');
      }      const data = await response.json();
      setCombinedPrompt(data.combined_prompt);
      setCombinedPromptData(data);
        // Create a comprehensive final prompt that properly combines everything
      const combinedAnalysis = data.combined_prompt || '';
      
      // Create comprehensive final prompt for identity preservation
      const comprehensiveFinalPrompt = `${combinedAnalysis}`.trim();
      
      setFinalPrompt(comprehensiveFinalPrompt);
      setShowFinalPrompt(true);
      setCurrentStep(4); // Move to final prompt editing step
      
      console.log('Generated identity-preserving final prompt:', comprehensiveFinalPrompt);

    } catch (err) {
      setError(err.message);
    } finally {
      setPromptPreviewLoading(false);
    }  };
  const handleGenerateImage = async () => {
    if (!finalPrompt.trim()) {
      setError('Please enter a final prompt');
      return;
    }

    setFusionLoading(true);
    setError('');
    setProgressStep(0);
    setGenerationProgress('Initializing...');

    try {
      // Step 1: Preparing data
      setProgressStep(1);
      setGenerationProgress('Preparing final prompt...');
      
      const formData = new FormData();
      formData.append('final_prompt', finalPrompt); // Send the complete final prompt
      
      if (projectId) {
        formData.append('project_id', projectId);
      }

      // Step 2: Sending request
      setProgressStep(2);
      setGenerationProgress('Generating image with final prompt...');

      console.log('Sending final prompt to backend:', finalPrompt);

      // Use text-to-image generation with the final prompt
      const response = await fetch('http://localhost:8000/fusion/generate-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate image');
      }

      // Step 3: Processing response
      setProgressStep(3);
      setGenerationProgress('Processing generated image...');

      const data = await response.json();
        if (data.success && data.image_data) {
        // Add to generated images array with timestamp
        const newImage = {
          id: Date.now(),
          image: data.image_data,
          image_url: data.image_url, // Add URL if available for persistence
          prompt: finalPrompt,
          timestamp: new Date().toLocaleString()
        };
        
        setGeneratedImages(prev => [newImage, ...prev]);
        setCurrentGeneratedImage(newImage);

        // Step 4: Complete
        setProgressStep(4);
        setGenerationProgress('Generation complete!');
        
        console.log('Image generated successfully using final prompt');
        if (data.image_url) {
          console.log('Image saved to session and will persist:', data.image_url);
        }
      } else {
        throw new Error(data.message || 'Failed to generate image');
      }
      setProgressStep(4);
      setGenerationProgress('Generation complete!');

    } catch (err) {
      setError(err.message);
      setGenerationProgress('Generation failed');
    } finally {
      setFusionLoading(false);
      // Clear progress after a delay
      setTimeout(() => {
        setGenerationProgress('');
        setProgressStep(0);
      }, 2000);
    }  };
  const handleDownload = (imageData = null) => {
    const imageToDownload = imageData || currentGeneratedImage?.image;
    const imageUrl = imageData ? null : currentGeneratedImage?.image_url;
    
    if (imageUrl) {
      // For URL-based images, fetch and download
      fetch(imageUrl)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `fusion-image-${Date.now()}.png`;
          link.click();
          window.URL.revokeObjectURL(url);
        })
        .catch(error => {
          console.error('Error downloading image:', error);
          setError('Failed to download image');
        });
    } else if (imageToDownload) {
      // For base64 images
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${imageToDownload}`;
      link.download = `fusion-image-${Date.now()}.png`;
      link.click();
    }
  };
  const clearAll = () => {
    setReferenceImages([]);
    setPrompt('');
    setCurrentGeneratedImage(null);
    setGeneratedImages([]);
    setFinalPrompt('');
    setShowFinalPrompt(false);
    setError('');
    setGenerationProgress('');
    setProgressStep(0);
    setImageAnalyses([]);
    setAnalysisComplete(false);
    setCombinedPrompt('');
    setCombinedPromptData(null);
    setShowCombinedPrompt(false);
    setCurrentStep(1);
  };

  const toggleDescriptionExpansion = (index) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedDescriptions(newExpanded);
  };

  // Function to start a new fusion session
  const startFusionSession = async () => {
    if (!projectId) return;
    try {
      const token = auth?.token;
      const response = await axios.post(
        `http://localhost:8000/projects/${projectId}/fusion/start-session`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFusionSession(response.data);
      return response.data;
    } catch (error) {
      setError('Failed to start fusion session');
      return null;
    }
  };

  // When user uploads images or starts the process, start a session if not already started
  const handleUploadImages = async (files) => {
    if (!fusionSession) {
      const session = await startFusionSession();
      if (!session) return;
    }
    // ... existing logic to handle image upload ...
  };

  // Function to delete a fusion session
  const handleDeleteSession = async (session) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };
  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      await fetch(`http://localhost:8000/projects/${projectId}/sessions/${sessionToDelete.name || sessionToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setFusionSessions(fusionSessions.filter(s => (s.id || s.name) !== (sessionToDelete.id || sessionToDelete.name)));
      setSessionToDelete(null);
      setDeleteDialogOpen(false);
      setFusionSession(null);
      setActiveSessionId(null);
      setGeneratedImages([]);
      setCurrentGeneratedImage(null);
      setPrompt('');
      setFinalPrompt('');
      setReferenceImages([]);
    } catch (err) {
      setError('Failed to delete session');
      setDeleteDialogOpen(false);
    }
  };

  // Function to load and restore a fusion session's details (now restores reference images and prompt)
  const loadFusionSessionDetails = async (session) => {
    try {
      setFusionSession(session);
      setActiveSessionId(session.id || session.name);
      // Fetch session details
      const detailsResponse = await fetch(
        `http://localhost:8000/projects/${projectId}/sessions/${session.id || session.name}/details`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (detailsResponse.ok) {
        const sessionData = await detailsResponse.json();
        // Restore prompt and final prompt (robust to missing fields)
        setPrompt(sessionData.input_data?.final_prompt || sessionData.input_data?.prompt || '');
        setFinalPrompt(sessionData.input_data?.final_prompt || sessionData.output_data?.final_prompt || '');
        setShowFinalPrompt(!!(sessionData.input_data?.final_prompt || sessionData.output_data?.final_prompt));
        // Restore reference images if available (simulate as preview images)
        if (sessionData.input_data && Array.isArray(sessionData.input_data.reference_images)) {
          setReferenceImages(sessionData.input_data.reference_images.map((img, idx) => ({
            file: null,
            name: img.filename || `reference_${idx+1}.png`,
            preview: img.url || img.base64 || ''
          })));
        } else {
          setReferenceImages([]);
        }
        // Restore generated images
        if (sessionData.image_files && sessionData.image_files.length > 0) {
          const fusionImages = sessionData.image_files.map((imageFile, index) => ({
            id: `fusion_${Date.now()}_${index}`,
            image_url: `http://localhost:8000${imageFile.url}`,
            prompt: sessionData.input_data?.final_prompt || sessionData.output_data?.final_prompt || 'Fusion image',
            timestamp: sessionData.session?.created_at ? new Date(sessionData.session.created_at).toLocaleString() : 'Unknown'
          }));
          setGeneratedImages(fusionImages);
          setCurrentGeneratedImage(fusionImages[0] || null);
        } else {
          setGeneratedImages([]);
          setCurrentGeneratedImage(null);
        }
      } else {
        // If detailsResponse is not ok, clear UI to safe state
        setPrompt('');
        setFinalPrompt('');
        setShowFinalPrompt(false);
        setReferenceImages([]);
        setGeneratedImages([]);
        setCurrentGeneratedImage(null);
        setError('Failed to load session details');
      }
    } catch (err) {
      setPrompt('');
      setFinalPrompt('');
      setShowFinalPrompt(false);
      setReferenceImages([]);
      setGeneratedImages([]);
      setCurrentGeneratedImage(null);
      setError('Failed to load session details');
    }
  };

  // Safety check to prevent rendering before auth is ready
  if (!auth) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }  return (
    <Box sx={{ 
      minHeight: '100vh', 
      bgcolor: 'hsl(0, 0%, 100%)', // --background
      color: 'hsl(222.2, 84%, 4.9%)', // --foreground
      p: 2,
      pt: 10 // Added padding-top for navbar spacing
    }}>
      <Container maxWidth={false} sx={{ maxWidth: '100%', px: 2 }}>        {/* Fusion Session List UI - now as cards with icons, delete, and click-to-load */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'hsl(222.2, 47.4%, 11.2%)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <FolderOpenIcon sx={{ color: 'hsl(215.4, 16.3%, 46.9%)' }} /> Fusion Sessions
          </Typography>
          {fusionSessionsLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <CircularProgress size={20} /> <span>Loading sessions...</span>
            </Box>
          ) : fusionSessionsError ? (
            <Alert severity="error" sx={{ mt: 1 }}>{fusionSessionsError}</Alert>
          ) : fusionSessions.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>No fusion sessions found for this project.</Alert>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {fusionSessions.map((session, idx) => {
                const isActive = (activeSessionId === (session.id || session.name));
                return (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={session.id || session.name}>
                    <Paper
                      elevation={isActive ? 6 : 1}
                      sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        cursor: 'pointer',
                        border: isActive ? '2px solid hsl(222.2, 47.4%, 11.2%)' : '1px solid hsl(214.3, 31.8%, 91.4%)',
                        bgcolor: isActive ? 'hsl(210, 40%, 96.1%)' : 'hsl(0, 0%, 100%)',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                      onClick={() => loadFusionSessionDetails(session)}
                    >
                      <PsychologyIcon sx={{ color: isActive ? 'hsl(222.2, 47.4%, 11.2%)' : 'hsl(215.4, 16.3%, 46.9%)', fontSize: 32 }} />
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: isActive ? 'hsl(222.2, 47.4%, 11.2%)' : 'hsl(215.4, 16.3%, 46.9%)' }}>
                          {`Session ${idx + 1}`}
                        </Typography>
                        {session.created_at && (
                          <Typography variant="caption" sx={{ color: 'hsl(215.4, 16.3%, 46.9%)' }}>
                            {new Date(session.created_at).toLocaleString()}
                          </Typography>
                        )}
                      </Box>
                      <IconButton
                        size="small"
                        sx={{ position: 'absolute', top: 4, right: 4, color: 'hsl(0, 84.2%, 60.2%)' }}
                        onClick={e => { e.stopPropagation(); handleDeleteSession(session); }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          )}
          {/* Delete confirmation dialog */}
          <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
            <DialogTitle>Delete Fusion Session</DialogTitle>
            <DialogContent>Are you sure you want to delete this fusion session? This cannot be undone.</DialogContent>
            <DialogActions>
              <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button color="error" onClick={confirmDeleteSession}>Delete</Button>
            </DialogActions>
          </Dialog>
        </Box>

        {/* Header */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 3,
          borderBottom: '1px solid hsl(214.3, 31.8%, 91.4%)', // --border
          pb: 2
        }}>          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'hsl(222.2, 47.4%, 11.2%)' }}> {/* --primary */}
            🚀 Smart Angle Generator
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip title="Get help with the workflow">
              <IconButton 
                onClick={() => setHelpOpen(true)} 
                sx={{ 
                  color: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                  '&:hover': {
                    bgcolor: 'hsl(210, 40%, 96.1%)', // --muted
                    color: 'hsl(222.2, 47.4%, 11.2%)' // --primary
                  }
                }}
              >
                <Help />
              </IconButton>
            </Tooltip>
            <Button 
              variant="outlined" 
              startIcon={<Clear />}
              onClick={clearAll}
              disabled={fusionLoading}
              sx={{
                borderColor: 'hsl(214.3, 31.8%, 91.4%)', // --border
                color: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                fontWeight: 'bold',
                '&:hover': {
                  borderColor: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                  bgcolor: 'hsl(210, 40%, 96.1%)', // --muted
                  color: 'hsl(222.2, 47.4%, 11.2%)' // --primary
                }
              }}
            >
              Clear All
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}        {/* Main Workflow - 3 Steps Side by Side */}
        <Grid container spacing={3} sx={{ mb: 3 }}>          {/* Step 1: Upload Images */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ 
              p: 3, 
              height: '100%',
              bgcolor: referenceImages.length > 0 ? 'hsl(210, 40%, 96.1%)' : 'hsl(0, 0%, 100%)', // --muted : --card
              border: '2px solid',
              borderColor: referenceImages.length > 0 ? 'hsl(222.2, 47.4%, 11.2%)' : 'hsl(214.3, 31.8%, 91.4%)', // --primary : --border
              borderRadius: 2,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: 'hsl(215.4, 16.3%, 46.9%)' // --muted-foreground
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PhotoCamera sx={{ color: 'hsl(222.2, 47.4%, 11.2%)' }} /> {/* --primary */}
                <Typography variant="h6" sx={{ color: 'hsl(222.2, 47.4%, 11.2%)', fontWeight: 'bold' }}> {/* --primary */}
                  Step 1: Upload Images
                </Typography>
              </Box>

              {/* Upload Button */}
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <Button
                variant="contained"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current.click()}
                fullWidth
                size="large"
                sx={{ 
                  mb: 2,
                  bgcolor: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                  color: 'hsl(210, 40%, 98%)', // --primary-foreground
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: 'hsl(222.2, 84%, 4.9%)' // --foreground (darker)
                  }
                }}
              >
                Upload Scene Images
              </Button>

              {/* Images Grid */}
              {referenceImages.length > 0 && (
                <Grid container spacing={1}>
                  {referenceImages.map((imageObj, index) => (
                    <Grid item xs={6} key={index}>
                      <Card sx={{ 
                        position: 'relative',
                        borderRadius: 1,
                        transition: 'transform 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'scale(1.02)'
                        }
                      }}>
                        <CardMedia
                          component="img"
                          height="80"
                          image={imageObj.preview}
                          alt={imageObj.name}
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handlePreviewImage(imageObj.preview)}
                        />
                        <IconButton
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }
                          }}
                          onClick={() => removeImage(index)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>
          </Grid>          {/* Step 2: Analyze Images */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ 
              p: 3, 
              height: '100%',
              bgcolor: analysisComplete ? 'hsl(210, 40%, 96.1%)' : 'hsl(0, 0%, 100%)', // --muted : --card
              border: '2px solid',
              borderColor: analysisComplete ? 'hsl(222.2, 47.4%, 11.2%)' : 'hsl(214.3, 31.8%, 91.4%)', // --primary : --border
              borderRadius: 2,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: 'hsl(215.4, 16.3%, 46.9%)' // --muted-foreground
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Psychology sx={{ color: 'hsl(222.2, 47.4%, 11.2%)' }} /> {/* --primary */}
                <Typography variant="h6" sx={{ color: 'hsl(222.2, 47.4%, 11.2%)', fontWeight: 'bold' }}> {/* --primary */}
                  Step 2: AI Analysis
                </Typography>
              </Box>
              
              <Button
                variant="contained"
                onClick={handleAnalyzeImages}
                disabled={analysisLoading || referenceImages.length === 0}
                startIcon={analysisLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
                fullWidth
                size="large"
                sx={{ 
                  mb: 2,
                  bgcolor: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                  color: 'hsl(210, 40%, 98%)', // --primary-foreground
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: 'hsl(222.2, 84%, 4.9%)' // --foreground (darker)
                  },
                  '&:disabled': {
                    bgcolor: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                    color: 'hsl(210, 40%, 98%)' // --primary-foreground
                  }
                }}
              >
                {analysisLoading ? 'Analyzing...' : 'Analyze Images'}
              </Button>

              {/* Analysis Results */}
              {imageAnalyses.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: 'hsl(222.2, 47.4%, 11.2%)' }}> {/* --primary */}
                    Analysis Results:
                  </Typography>
                  {imageAnalyses.map((analysis, index) => (
                    <Box key={index} sx={{ 
                      p: 1, 
                      mb: 1, 
                      borderRadius: 1,
                      bgcolor: analysis.status === 'success' ? 'hsl(210, 40%, 96.1%)' : 'hsl(0, 84.2%, 95%)', // --muted : light destructive
                      border: '1px solid',
                      borderColor: analysis.status === 'success' ? 'hsl(214.3, 31.8%, 91.4%)' : 'hsl(0, 84.2%, 60.2%)' // --border : --destructive
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ 
                          fontWeight: 'bold',
                          color: analysis.status === 'success' ? 'hsl(222.2, 47.4%, 11.2%)' : 'hsl(0, 84.2%, 60.2%)' // --primary : --destructive
                        }}>
                          {analysis.status === 'success' ? '✅' : '❌'} {analysis.filename}
                        </Typography>
                        {analysis.status === 'success' && (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => toggleDescriptionExpansion(index)}
                            sx={{ 
                              textTransform: 'none',
                              minWidth: 'auto',
                              p: 0.5,
                              fontSize: '0.7rem',
                              color: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                              '&:hover': {
                                color: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                                bgcolor: 'hsl(210, 40%, 96.1%)' // --muted
                              }
                            }}
                          >
                            {expandedDescriptions.has(index) ? 'Hide' : 'View'}
                          </Button>
                        )}
                      </Box>
                      
                      {analysis.status === 'success' && (
                        <>
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: 'hsl(215.4, 16.3%, 46.9%)' }}> {/* --muted-foreground */}
                            {analysis.description.length} characters extracted
                          </Typography>
                          
                          {expandedDescriptions.has(index) && (
                            <Box sx={{ 
                              mt: 1,
                              p: 1,
                              bgcolor: 'hsl(0, 0%, 100%)', // --card
                              borderRadius: 0.5,
                              border: '1px solid hsl(214.3, 31.8%, 91.4%)', // --border
                              maxHeight: 150,
                              overflowY: 'auto'
                            }}>
                              <Typography variant="caption" sx={{ 
                                fontFamily: 'monospace',
                                fontSize: '0.7rem',
                                lineHeight: 1.3,
                                whiteSpace: 'pre-wrap',
                                color: 'hsl(222.2, 84%, 4.9%)' // --foreground
                              }}>
                                {analysis.description}
                              </Typography>
                            </Box>
                          )}
                        </>
                      )}
                      
                      {analysis.status === 'error' && (
                        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: 'hsl(0, 84.2%, 60.2%)' }}> {/* --destructive */}
                          Error: {analysis.error}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>          {/* Step 3: Enter Desired Angle */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ 
              p: 3, 
              height: '100%',
              bgcolor: prompt.trim() && analysisComplete ? 'hsl(210, 40%, 96.1%)' : 'hsl(0, 0%, 100%)', // --muted : --card
              border: '2px solid',
              borderColor: prompt.trim() && analysisComplete ? 'hsl(222.2, 47.4%, 11.2%)' : 'hsl(214.3, 31.8%, 91.4%)', // --primary : --border
              borderRadius: 2,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                borderColor: 'hsl(215.4, 16.3%, 46.9%)' // --muted-foreground
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CameraAlt sx={{ color: 'hsl(222.2, 47.4%, 11.2%)' }} /> {/* --primary */}
                <Typography variant="h6" sx={{ color: 'hsl(222.2, 47.4%, 11.2%)', fontWeight: 'bold' }}> {/* --primary */}
                  Step 3: Desired Angle
                </Typography>
              </Box>

              <TextField
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                placeholder="Enter your desired angle or viewpoint..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: 'hsl(214.3, 31.8%, 91.4%)' // --border
                    },
                    '&:hover fieldset': {
                      borderColor: 'hsl(215.4, 16.3%, 46.9%)' // --muted-foreground
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'hsl(222.2, 47.4%, 11.2%)' // --primary
                    }
                  },
                  '& .MuiInputBase-input': {
                    color: 'hsl(222.2, 84%, 4.9%)' // --foreground
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                    opacity: 1
                  }
                }}
                disabled={!analysisComplete}
              />
              
              {analysisComplete && prompt.trim() && (
                <Button
                  variant="contained"
                  onClick={handlePreviewCombinedPrompt}
                  disabled={promptPreviewLoading}
                  startIcon={promptPreviewLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}                  fullWidth
                  size="large"
                  sx={{
                    bgcolor: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                    color: 'hsl(210, 40%, 98%)', // --primary-foreground
                    fontWeight: 'bold',
                    '&:hover': {
                      bgcolor: 'hsl(222.2, 84%, 4.9%)' // --foreground (darker)
                    },
                    '&:disabled': {
                      bgcolor: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                      color: 'hsl(210, 40%, 98%)' // --primary-foreground
                    }
                  }}
                >
                  {promptPreviewLoading ? 'Creating Final Prompt...' : 'Create Final Prompt'}
                </Button>
              )}
            </Paper>
          </Grid>
        </Grid>        {/* Step 4: Final Prompt Editing & Generation */}
        {showFinalPrompt && (
          <Paper sx={{ 
            p: 3, 
            mb: 3, 
            bgcolor: 'hsl(210, 40%, 96.1%)', // --muted
            border: '2px solid hsl(214.3, 31.8%, 91.4%)', // --border
            borderRadius: 2
          }}>
            <Typography variant="h6" gutterBottom sx={{ 
              color: 'hsl(222.2, 47.4%, 11.2%)', // --primary
              fontWeight: 'bold',
              mb: 1
            }}>
              🚀 Step 4: Final Prompt & Generate
            </Typography>
              <Typography variant="body2" sx={{ mb: 3, color: 'hsl(215.4, 16.3%, 46.9%)' }}> {/* --muted-foreground */}
              The final prompt below combines your reference images with your desired angle. You can edit it if needed, then generate your image. Generate multiple variations by editing the prompt each time.
            </Typography>
            
            <Grid container spacing={3}>
              {/* Final Prompt Editor */}
              <Grid item xs={12} md={8}>                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  variant="outlined"
                  label="Final Generation Prompt (Auto-Generated, Editable)"
                  helperText="This prompt combines your reference images with your desired angle. Edit as needed before generating."
                  value={finalPrompt}
                  onChange={(e) => setFinalPrompt(e.target.value)}
                  sx={{ 
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'hsl(214.3, 31.8%, 91.4%)' // --border
                      },
                      '&:hover fieldset': {
                        borderColor: 'hsl(215.4, 16.3%, 46.9%)' // --muted-foreground
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'hsl(222.2, 47.4%, 11.2%)' // --primary
                      }
                    },
                    '& .MuiInputBase-input': {
                      color: 'hsl(222.2, 84%, 4.9%)', // --foreground
                      fontSize: '0.9rem',
                      lineHeight: 1.4
                    },                    '& .MuiInputLabel-root': {
                      color: 'hsl(215.4, 16.3%, 46.9%)' // --muted-foreground
                    },
                    '& .MuiFormHelperText-root': {
                      color: 'hsl(215.4, 16.3%, 46.9%)' // --muted-foreground
                    }
                  }}
                />
                
                <Button
                  variant="contained"
                  onClick={handleGenerateImage}
                  disabled={fusionLoading || !finalPrompt.trim()}
                  startIcon={fusionLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
                  size="large"
                  sx={{
                    bgcolor: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                    color: 'hsl(210, 40%, 98%)', // --primary-foreground
                    fontWeight: 'bold',
                    py: 1.5,
                    px: 4,
                    '&:hover': {
                      bgcolor: 'hsl(222.2, 84%, 4.9%)' // --foreground (darker)
                    },
                    '&:disabled': {
                      bgcolor: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                      color: 'hsl(210, 40%, 98%)' // --primary-foreground
                    }
                  }}
                >
                  {fusionLoading ? 'Generating Image...' : 'Generate Image'}
                </Button>
              </Grid>
              
              {/* Generation Info */}
              <Grid item xs={12} md={4}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'hsl(0, 0%, 100%)', // --card
                  borderRadius: 1,
                  border: '1px solid hsl(214.3, 31.8%, 91.4%)', // --border
                  height: 'fit-content'
                }}>                  <Typography variant="subtitle2" gutterBottom sx={{ color: 'hsl(222.2, 47.4%, 11.2%)', fontWeight: 'bold' }}> {/* --primary */}
                    ✨ Final Prompt Info:
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'hsl(215.4, 16.3%, 46.9%)', mb: 2 }}> {/* --muted-foreground */}
                    <strong>Reference Images:</strong> {imageAnalyses.length}<br/>
                    <strong>Your Angle:</strong> {prompt}<br/>
                    <strong>Generated Images:</strong> {generatedImages.length}<br/>
                    <strong>Status:</strong> Ready to generate
                  </Typography>
                  
                  {generatedImages.length > 0 && (
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'hsl(215.4, 16.3%, 46.9%)' }}> {/* --muted-foreground */}
                      <strong>💡 Tip:</strong> Edit the prompt above to try different variations of your image.
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>

            {/* Generation Progress */}
            {fusionLoading && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'hsl(210, 40%, 96.1%)', borderRadius: 1, textAlign: 'center', border: '1px solid hsl(214.3, 31.8%, 91.4%)' }}>
                <Typography variant="body2" sx={{ color: 'hsl(222.2, 47.4%, 11.2%)', fontWeight: 'bold' }} gutterBottom>
                  {generationProgress}
                </Typography>
                <Typography variant="caption" sx={{ color: 'hsl(215.4, 16.3%, 46.9%)' }}>
                  Step {progressStep}/4 - Please wait while we generate your image...
                </Typography>
              </Box>
            )}
          </Paper>
        )}

        {/* Generated Images Gallery */}
        {generatedImages.length > 0 && (
          <Paper sx={{ 
            p: 3, 
            mb: 3, 
            bgcolor: 'hsl(0, 0%, 100%)', // --card
            border: '2px solid hsl(214.3, 31.8%, 91.4%)', // --border
            borderRadius: 2
          }}>
            <Typography variant="h6" gutterBottom sx={{ 
              color: 'hsl(222.2, 47.4%, 11.2%)', // --primary
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              🎨 Generated Images ({generatedImages.length})
            </Typography>
            
            <Grid container spacing={3}>
              {generatedImages.map((imageObj, index) => (
                <Grid item xs={12} md={6} lg={4} key={imageObj.id}>
                  <Card sx={{ 
                    borderRadius: 2,
                    border: currentGeneratedImage?.id === imageObj.id ? '2px solid hsl(222.2, 47.4%, 11.2%)' : '1px solid hsl(214.3, 31.8%, 91.4%)', // --primary : --border
                    bgcolor: 'hsl(0, 0%, 100%)', // --card
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }
                  }}>                    <CardMedia
                      component="img"
                      image={imageObj.image_url || `data:image/png;base64,${imageObj.image}`}
                      alt={`Generated image ${index + 1}`}
                      sx={{
                        height: 200,
                        objectFit: 'cover',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setCurrentGeneratedImage(imageObj);
                        handlePreviewImage(imageObj.image_url || `data:image/png;base64,${imageObj.image}`);
                      }}
                    />
                    <Box sx={{ p: 2 }}>
                      <Typography variant="caption" sx={{ 
                        display: 'block',
                        color: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                        mb: 1
                      }}>
                        Generated: {imageObj.timestamp}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<Download />}
                          onClick={() => {
                            // Set as current image temporarily and download
                            const prevCurrent = currentGeneratedImage;
                            setCurrentGeneratedImage(imageObj);
                            setTimeout(() => {
                              handleDownload();
                              setCurrentGeneratedImage(prevCurrent);
                            }, 10);
                          }}
                          sx={{
                            bgcolor: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                            color: 'hsl(210, 40%, 98%)', // --primary-foreground
                            '&:hover': {
                              bgcolor: 'hsl(222.2, 84%, 4.9%)' // --foreground (darker)
                            }
                          }}
                        >
                          Download
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setCurrentGeneratedImage(imageObj)}
                          sx={{
                            borderColor: 'hsl(214.3, 31.8%, 91.4%)', // --border
                            color: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
                            '&:hover': {
                              borderColor: 'hsl(222.2, 47.4%, 11.2%)', // --primary
                              color: 'hsl(222.2, 47.4%, 11.2%)' // --primary
                            }
                          }}
                        >
                          Select
                        </Button>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {/* Help Dialog */}
        <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Help />
              🚀 How Smart Angle Generator Works
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📋 4-Step Smart Angle Process
              </Typography>
              
              <Typography variant="body1" sx={{ mb: 3 }}>
                Our Smart Angle Generator uses advanced AI to create new viewpoints while preserving every detail from your reference images.
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'success.main' }}>
                  📋 Step-by-Step Workflow:
                </Typography>
                
                <Box sx={{ ml: 1 }}>
                  <Typography variant="body2" sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}>
                    <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold', mr: 1, mt: 0.1 }}>1.</Box>
                    <Box>
                      <strong>Upload Reference Images:</strong> Add 1-5 high-quality images of your scene/object showing the elements you want to preserve.
                    </Box>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}>
                    <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold', mr: 1, mt: 0.1 }}>2.</Box>
                    <Box>
                      <strong>AI Vision Analysis:</strong> Click "Analyze Images" - AI extracts detailed descriptions of lighting, colors, objects, background, style, and atmosphere.
                    </Box>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}>
                    <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold', mr: 1, mt: 0.1 }}>3.</Box>
                    <Box>
                      <strong>Specify New Angle:</strong> Enter your desired viewpoint or perspective (e.g., "side view", "from above", "behind the object").
                    </Box>
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}>
                    <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold', mr: 1, mt: 0.1 }}>4.</Box>
                    <Box>
                      <strong>Smart Merging & Generation:</strong> AI intelligently combines descriptions with your request and generates your new viewpoint.
                    </Box>
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h6" gutterBottom color="success.main">
                ✅ What You Get:
              </Typography>
              
              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                <li>Same scene, same objects, same lighting</li>
                <li>Same visual style and color palette</li>
                <li>New perspective as requested</li>
                <li>Elements not visible in your references (generated consistently)</li>
              </Box>

              <Typography variant="h6" gutterBottom color="warning.main">
                💡 Pro Tips:
              </Typography>
              
              <Box component="ul" sx={{ pl: 2 }}>
                <li><strong>Hidden Elements:</strong> Request parts not visible in your images</li>
                <li><strong>New Perspectives:</strong> Ask for angles that reveal new elements</li>
                <li><strong>Close-ups:</strong> Request detailed views of specific objects</li>
                <li><strong>Different Heights:</strong> Change viewing height ("ground level", "bird's eye view")</li>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHelpOpen(false)}>Got it!</Button>
          </DialogActions>
        </Dialog>

        {/* Image Preview Dialog */}
        <Dialog 
          open={previewOpen} 
          onClose={() => setPreviewOpen(false)} 
          maxWidth="lg" 
          fullWidth
        >
          <DialogTitle>Image Preview</DialogTitle>
          <DialogContent>
            {previewImage && (
              <img 
                src={previewImage} 
                alt="Preview" 
                style={{ width: '100%', height: 'auto' }} 
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default ImageFusion;
