import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Chip,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  ZoomIn,
  Settings,
  PlayArrow,
  Download
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const ImageFusion = () => {
  const { token } = useAuth();
  const [referenceImages, setReferenceImages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [fusionLoading, setFusionLoading] = useState(false);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  
  // Advanced settings
  const [modelName, setModelName] = useState('runwayml/stable-diffusion-v1-5');
  const [strength, setStrength] = useState(0.8);
  const [guidanceScale, setGuidanceScale] = useState(8.5);
  const [numInferenceSteps, setNumInferenceSteps] = useState(50);
  
  const fileInputRef = useRef(null);

  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    
    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Convert files to preview URLs
    const newImages = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
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
    setImagePreviewOpen(true);
  };

  const handleGenerateFusion = async () => {
    if (!token) {
      setError('You are not logged in. Please log in again.');
      return;
    }

    if (referenceImages.length === 0) {
      setError('Please upload at least one reference image');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setFusionLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('model_name', modelName);
      formData.append('strength', strength);
      formData.append('guidance_scale', guidanceScale);
      formData.append('num_inference_steps', numInferenceSteps);

      referenceImages.forEach((imageObj) => {
        formData.append('reference_images', imageObj.file);
      });

      const response = await fetch('http://localhost:8000/fusion/generate', {
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
        throw new Error(errorData.detail || 'Failed to generate fusion image');
      }

      const data = await response.json();
      setGeneratedImage(data.image_url);

    } catch (err) {
      setError(err.message);
    } finally {
      setFusionLoading(false);
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
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Image Fusion Generator
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Upload multiple reference images and provide a prompt to generate a single fused image that combines elements from all references.
      </Typography>

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
              Input Images & Prompt
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
                Upload Reference Images
              </Button>
              
              {referenceImages.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {referenceImages.length} image(s) uploaded
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
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Describe your desired image"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate, incorporating elements from your reference images..."
              sx={{ mb: 3 }}
            />

            {/* Settings Button */}
            <Button
              variant="outlined"
              startIcon={<Settings />}
              onClick={() => setSettingsOpen(true)}
              sx={{ mb: 2 }}
            >
              Advanced Settings
            </Button>

            {/* Generate Button */}
            <Button
              variant="contained"
              startIcon={fusionLoading ? <CircularProgress size={20} /> : <PlayArrow />}
              onClick={handleGenerateFusion}
              disabled={fusionLoading || referenceImages.length === 0 || !prompt.trim()}
              fullWidth
              sx={{ mb: 2 }}
            >
              {fusionLoading ? 'Generating...' : 'Generate Fusion Image'}
            </Button>

            <Button
              variant="outlined"
              onClick={clearAll}
              fullWidth
            >
              Clear All
            </Button>
          </Paper>
        </Grid>

        {/* Right Panel - Output */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, minHeight: 400 }}>
            <Typography variant="h6" gutterBottom>
              Generated Image
            </Typography>

            {fusionLoading ? (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <CircularProgress />
                <Typography>Generating image, please wait...</Typography>
              </Box>
            ) : generatedImage ? (
              <Box>
                <Card>
                  <CardMedia
                    component="img"
                    image={`data:image/png;base64,${generatedImage}`}
                    alt="Generated fusion image"
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handlePreviewImage(`data:image/png;base64,${generatedImage}`)}
                  />
                </Card>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<ZoomIn />}
                    onClick={() => handlePreviewImage(`data:image/png;base64,${generatedImage}`)}
                  >
                    View Full Size
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={handleDownload}
                  >
                    Download
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 300,
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  borderRadius: 1
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  Generated image will appear here
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Advanced Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Model</InputLabel>
              <Select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                label="Model"
              >
                <MenuItem value="runwayml/stable-diffusion-v1-5">Stable Diffusion v1.5</MenuItem>
                <MenuItem value="stabilityai/stable-diffusion-2-1">Stable Diffusion v2.1</MenuItem>
                <MenuItem value="runwayml/stable-diffusion-v1-5-inpainting">Stable Diffusion Inpainting</MenuItem>
              </Select>
            </FormControl>

            <Typography gutterBottom>Strength: {strength}</Typography>
            <Slider
              value={strength}
              onChange={(e, value) => setStrength(value)}
              min={0.1}
              max={1.0}
              step={0.1}
              marks
              sx={{ mb: 3 }}
            />

            <Typography gutterBottom>Guidance Scale: {guidanceScale}</Typography>
            <Slider
              value={guidanceScale}
              onChange={(e, value) => setGuidanceScale(value)}
              min={1.0}
              max={20.0}
              step={0.5}
              marks
              sx={{ mb: 3 }}
            />

            <Typography gutterBottom>Inference Steps: {numInferenceSteps}</Typography>
            <Slider
              value={numInferenceSteps}
              onChange={(e, value) => setNumInferenceSteps(value)}
              min={20}
              max={100}
              step={5}
              marks
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog
        open={imagePreviewOpen}
        onClose={() => setImagePreviewOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              style={{ width: '100%', height: 'auto' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImagePreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImageFusion; 