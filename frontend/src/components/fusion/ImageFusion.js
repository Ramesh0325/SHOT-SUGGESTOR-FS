import React, { useState, useRef } from 'react';
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
  Tooltip
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Download,
  Clear,
  AutoAwesome,
  Help
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const ImageFusion = () => {
  const { token } = useAuth();
  const [referenceImages, setReferenceImages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState('');
  const [fusionLoading, setFusionLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const fileInputRef = useRef();

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImages = files.map(file => ({
      file,
      name: file.name,
      preview: URL.createObjectURL(file)
    }));
    setReferenceImages(prev => [...prev, ...newImages]);
    setError('');
  };

  const removeImage = (index) => {
    setReferenceImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      return newImages;
    });
  };

  const handlePreviewImage = (image) => {
    setPreviewImage(image);
    setPreviewOpen(true);
  };

  const handleGenerateFusion = async () => {
    if (referenceImages.length === 0) {
      setError('Please upload at least one reference image');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a description of the new angle/view');
      return;
    }

    setFusionLoading(true);
    setError('');
    setProgressStep(0);
    setGenerationProgress('Initializing...');

    try {
      // Step 1: Preparing data
      setProgressStep(1);
      setGenerationProgress('Preparing reference images...');
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      // Backend now has optimized default parameters for better "same world, new angle" generation
      // strength: 0.55, guidance_scale: 13.0, num_inference_steps: 90
      // These are automatically applied by the backend for optimal results

      // Add all reference images - use 'files' field name to match backend
      referenceImages.forEach((imageObj) => {
        formData.append('files', imageObj.file);
      });

      // Step 2: Sending request
      setProgressStep(2);
      setGenerationProgress('Analyzing reference images...');

      const response = await fetch('http://localhost:8000/api/theme-preserve', {
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
        throw new Error(errorData.detail || 'Failed to generate theme-preserving image');
      }

      // Step 3: Processing response
      setProgressStep(3);
      setGenerationProgress('Processing generated image...');

      const data = await response.json();
      setGeneratedImage(data.image);

      // Step 4: Complete
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
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${generatedImage}`;
      link.download = 'fusion-image.png';
      link.click();
    }
  };

  const clearAll = () => {
    setReferenceImages([]);
    setPrompt('');
    setGeneratedImage(null);
    setError('');
    setGenerationProgress('');
    setProgressStep(0);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        🎬 Same World, New Angle
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ flex: 1 }}>
          Upload images of your scene, then describe the angle you want. The AI will show you the exact same world from that new perspective - including elements not visible in your reference images. Uses optimized parameters for maximum world preservation.
        </Typography>
        <Tooltip title="Learn how to use this tool">
          <IconButton 
            size="small" 
            onClick={() => setHelpOpen(true)}
            sx={{ mt: -0.5 }}
          >
            <Help color="primary" />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Panel - Input */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom>
              📸 Your Scene Images
            </Typography>

            {/* Image Upload */}
            <Box sx={{ mb: 3 }}>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current.click()}
                fullWidth
                sx={{ mb: 2 }}
              >
                Upload Scene Images (1-5 photos)
              </Button>
              
              {referenceImages.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {referenceImages.length} scene image(s) uploaded
                </Typography>
              )}
            </Box>

            {/* Reference Images Grid */}
            {referenceImages.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={1}>
                  {referenceImages.map((imageObj, index) => (
                    <Grid item xs={6} sm={4} key={index}>
                      <Card sx={{ position: 'relative' }}>
                        <CardMedia
                          component="img"
                          height="120"
                          image={imageObj.preview}
                          alt={imageObj.name}
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handlePreviewImage(imageObj.preview)}
                        />
                        <IconButton
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                          }}
                          onClick={() => removeImage(index)}
                        >
                          <Delete />
                        </IconButton>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Prompt Input */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                🎯 Desired Angle
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                placeholder="Describe the angle you want to see. Examples: 'Close-up from above', 'Show feet of the king', 'Camera at ground level', 'Behind the throne', 'Low angle shot', 'Bird's eye view'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                The AI will show you the same world from this new angle, including elements not visible in your reference images.
              </Typography>
            </Box>

            {/* Generate Button */}
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleGenerateFusion}
              disabled={fusionLoading || referenceImages.length === 0 || !prompt.trim()}
              startIcon={fusionLoading ? <CircularProgress size={20} /> : <AutoAwesome />}
              sx={{ mb: 2 }}
            >
              {fusionLoading ? 'Generating New Angle...' : 'Generate New Angle'}
            </Button>

            {/* Progress Indicator */}
            {fusionLoading && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="primary" gutterBottom>
                  {generationProgress}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1, bgcolor: 'grey.200', borderRadius: 1, height: 8 }}>
                    <Box
                      sx={{
                        bgcolor: 'primary.main',
                        height: '100%',
                        borderRadius: 1,
                        width: `${(progressStep / 4) * 100}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {progressStep}/4
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {progressStep === 1 && "Preparing your reference images for analysis..."}
                  {progressStep === 2 && "AI is analyzing your scene and generating the new angle..."}
                  {progressStep === 3 && "Processing the final image..."}
                  {progressStep === 4 && "Ready! Your new angle is complete."}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Using optimized parameters for maximum world preservation
                </Typography>
              </Box>
            )}

            {/* Clear Button */}
            <Button
              variant="outlined"
              fullWidth
              onClick={clearAll}
              startIcon={<Clear />}
            >
              Clear All
            </Button>
          </Paper>
        </Grid>

        {/* Right Panel - Output */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom>
              🖼️ Generated Image
            </Typography>
            
            {generatedImage ? (
              <Box>
                <Card sx={{ mb: 2 }}>
                  <CardMedia
                    component="img"
                    image={`data:image/png;base64,${generatedImage}`}
                    alt="Generated fusion image"
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handlePreviewImage(`data:image/png;base64,${generatedImage}`)}
                  />
                </Card>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleDownload}
                  startIcon={<Download />}
                >
                  Download Image
                </Button>
              </Box>
            ) : (
              <Box sx={{ 
                height: 400, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '2px dashed #ccc',
                borderRadius: 1
              }}>
                <Typography variant="body1" color="text.secondary">
                  Generated image will appear here
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Help Dialog */}
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Help />
            How to Use Same World, New Angle
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="h6" gutterBottom color="primary">
              🎬 Simple 2-Step Process
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 2 }}>
              Upload images of your scene, describe the angle you want, and get the same world from that new perspective.
            </Typography>

            <Typography variant="h6" gutterBottom>
              📋 Step-by-Step Guide:
            </Typography>
            
            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
              <li>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Upload Scene Images:</strong> Upload 1-5 photos of the scene/location you want to explore from different angles.
                </Typography>
              </li>
              <li>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Describe Your Angle:</strong> Tell the AI what angle you want to see. Examples:
                </Typography>
                <Box component="ul" sx={{ pl: 2, mb: 1 }}>
                  <li>"Close-up from above"</li>
                  <li>"Show feet of the king"</li>
                  <li>"Camera at ground level"</li>
                  <li>"Behind the throne"</li>
                  <li>"Low angle shot"</li>
                  <li>"Bird's eye view"</li>
                  <li>"From the other side"</li>
                </Box>
              </li>
              <li>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Generate:</strong> Click the button and see your same world from the new angle.
                </Typography>
              </li>
            </Box>

            <Typography variant="h6" gutterBottom color="success.main">
              ✅ What You Get:
            </Typography>
            
            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
              <li>Same scene, same objects, same lighting</li>
              <li>Same visual style and color palette</li>
              <li>New perspective as requested</li>
              <li>Elements not visible in your references (generated consistently)</li>
              <li>Optimized AI parameters for maximum world preservation</li>
            </Box>

            <Typography variant="h6" gutterBottom color="warning.main">
              💡 Pro Tips:
            </Typography>
            
            <Box component="ul" sx={{ pl: 2, mb: 2 }}>
              <li><strong>Hidden Elements:</strong> Request parts not visible in your images (e.g., "feet of the king", "back of the throne")</li>
              <li><strong>New Perspectives:</strong> Ask for angles that reveal new elements (e.g., "from below", "behind the subject")</li>
              <li><strong>Close-ups:</strong> Request detailed views (e.g., "close-up of the crown", "hands holding the sword")</li>
              <li><strong>Different Heights:</strong> Change viewing height (e.g., "ground level", "bird's eye view")</li>
              <li><strong>Multiple References:</strong> Upload 2-3 images of the same scene for better world understanding</li>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>How it works:</strong> The AI analyzes your scene images to understand the complete visual world, then generates the same world from your requested angle - including elements not visible in your reference images. Uses optimized parameters (strength: 0.55, guidance: 13.0, steps: 90) for maximum world preservation.
              </Typography>
            </Alert>
            
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Perfect for:</strong> Film pre-production, set design, storyboarding, photography planning, and visualizing scenes from different angles.
              </Typography>
            </Alert>
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
    </Box>
  );
};

export default ImageFusion; 