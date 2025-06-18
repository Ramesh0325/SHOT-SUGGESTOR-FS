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
  DialogActions,
  Tooltip,
  Divider,
  FormHelperText
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  ZoomIn,
  Settings,
  PlayArrow,
  Download,
  Info,
  AutoAwesome,
  Help
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
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Advanced settings
  const [fusionMethod, setFusionMethod] = useState('blend'); // 'blend' or 'reference'
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
      
      // Add advanced settings based on fusion method
      if (fusionMethod === 'blend') {
        formData.append('model_name', modelName);
        formData.append('strength', strength);
        formData.append('guidance_scale', guidanceScale);
        formData.append('num_inference_steps', numInferenceSteps);
      }

      referenceImages.forEach((imageObj) => {
        formData.append(fusionMethod === 'reference' ? 'files' : 'reference_images', imageObj.file);
      });

      // Choose endpoint based on fusion method
      const endpoint = fusionMethod === 'reference' 
        ? 'http://localhost:8000/api/fuse-reference'
        : 'http://localhost:8000/fusion/generate';

      const response = await fetch(endpoint, {
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
      setGeneratedImage(data.image || data.image_url);

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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ flex: 1 }}>
          Upload multiple reference images and provide a prompt to generate a single fused image. 
          Choose between <strong>Blend Fusion</strong> (combines all references) or 
          <strong> Reference Style Transfer</strong> (uses first image for style, prompt for content).
        </Typography>
        <Tooltip title="Learn how to use advanced settings">
          <IconButton 
            size="small" 
            onClick={() => setHelpOpen(true)}
            sx={{ mt: -0.5 }}
          >
            <Info color="primary" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Fusion Method Indicator */}
      <Box sx={{ mb: 2 }}>
        <Tooltip title={`Current mode: ${fusionMethod === 'blend' ? 'Blend Fusion - combines all references' : 'Reference Style Transfer - uses first image for style'}. Click for detailed explanation.`}>
          <Chip
            icon={fusionMethod === 'reference' ? <AutoAwesome color="primary" /> : <AutoAwesome />}
            label={fusionMethod === 'blend' ? 'Blend Fusion Mode' : 'Reference Style Transfer Mode'}
            color={fusionMethod === 'reference' ? 'primary' : 'default'}
            variant="outlined"
            sx={{ cursor: 'pointer' }}
            onClick={() => setHelpOpen(true)}
          />
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

            {/* Settings Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Help />}
                onClick={() => setHelpOpen(true)}
                sx={{ flex: 1 }}
              >
                How to Use Settings
              </Button>
              <Button
                variant="outlined"
                startIcon={<Settings />}
                onClick={() => setSettingsOpen(true)}
                sx={{ flex: 1 }}
              >
                Advanced Settings
              </Button>
            </Box>

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
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings />
            Advanced Settings
            <Tooltip title="Configure how your reference images are processed and fused">
              <IconButton size="small">
                <Info />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {/* Fusion Method Selection */}
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Fusion Method</InputLabel>
              <Select
                value={fusionMethod}
                onChange={(e) => setFusionMethod(e.target.value)}
                label="Fusion Method"
              >
                <MenuItem value="blend">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesome />
                    Blend Fusion (Default)
                  </Box>
                </MenuItem>
                <MenuItem value="reference">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesome color="primary" />
                    Reference Style Transfer (Advanced)
                  </Box>
                </MenuItem>
              </Select>
              <FormHelperText>
                {fusionMethod === 'blend' 
                  ? 'Blends all reference images together, then applies your prompt'
                  : 'Uses the first reference image for style/theme, applies your prompt for content'
                }
              </FormHelperText>
            </FormControl>

            {fusionMethod === 'blend' && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>Blend Settings</Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    label="Model"
                  >
                    <MenuItem value="runwayml/stable-diffusion-v1-5">Stable Diffusion v1.5 (Recommended)</MenuItem>
                    <MenuItem value="stabilityai/stable-diffusion-2-1">Stable Diffusion v2.1</MenuItem>
                    <MenuItem value="runwayml/stable-diffusion-v1-5-inpainting">Stable Diffusion Inpainting</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography gutterBottom>Strength: {strength}</Typography>
                    <Tooltip title="Controls how much the reference images influence the final result. Higher values = more reference influence">
                      <IconButton size="small">
                        <Info />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Slider
                    value={strength}
                    onChange={(e, value) => setStrength(value)}
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    marks={[
                      { value: 0.1, label: 'Light' },
                      { value: 0.5, label: 'Balanced' },
                      { value: 0.8, label: 'Strong' },
                      { value: 1.0, label: 'Max' }
                    ]}
                  />
                  <FormHelperText>
                    {strength <= 0.3 ? 'Light blending - keeps more of original reference' :
                     strength <= 0.6 ? 'Balanced fusion - good mix of reference and prompt' :
                     strength <= 0.9 ? 'Strong blending - heavy reference influence' :
                     'Maximum transformation - strongest reference influence'}
                  </FormHelperText>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography gutterBottom>Guidance Scale: {guidanceScale}</Typography>
                    <Tooltip title="How closely the AI follows your prompt. Higher values = more prompt-following, less creative">
                      <IconButton size="small">
                        <Info />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Slider
                    value={guidanceScale}
                    onChange={(e, value) => setGuidanceScale(value)}
                    min={1.0}
                    max={20.0}
                    step={0.5}
                    marks={[
                      { value: 1.0, label: 'Creative' },
                      { value: 7.5, label: 'Balanced' },
                      { value: 15.0, label: 'Strict' },
                      { value: 20.0, label: 'Very Strict' }
                    ]}
                  />
                  <FormHelperText>
                    {guidanceScale <= 5.0 ? 'Creative - less prompt-following, more artistic freedom' :
                     guidanceScale <= 10.0 ? 'Balanced - good mix of creativity and prompt adherence' :
                     guidanceScale <= 15.0 ? 'Strict - closely follows your prompt' :
                     'Very strict - maximum prompt adherence, minimal creativity'}
                  </FormHelperText>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography gutterBottom>Inference Steps: {numInferenceSteps}</Typography>
                    <Tooltip title="Number of denoising steps. Higher values = better quality but slower generation">
                      <IconButton size="small">
                        <Info />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Slider
                    value={numInferenceSteps}
                    onChange={(e, value) => setNumInferenceSteps(value)}
                    min={20}
                    max={100}
                    step={5}
                    marks={[
                      { value: 20, label: 'Fast' },
                      { value: 50, label: 'Good' },
                      { value: 80, label: 'High' },
                      { value: 100, label: 'Max' }
                    ]}
                  />
                  <FormHelperText>
                    {numInferenceSteps <= 30 ? 'Fast generation, lower quality' :
                     numInferenceSteps <= 60 ? 'Good balance of speed and quality' :
                     numInferenceSteps <= 80 ? 'Higher quality, slower generation' :
                     'Maximum quality, very slow generation'}
                  </FormHelperText>
                </Box>
              </>
            )}

            {fusionMethod === 'reference' && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>Reference Style Transfer</Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>How it works:</strong> Uses the first reference image for style/theme, 
                    then applies your prompt to create new content in that style. 
                    This is more advanced than simple blending and creates more stylistically consistent results.
                  </Typography>
                </Alert>
                <Typography variant="body2" color="text.secondary">
                  • The first image you upload will be used as the style reference<br/>
                  • Your prompt describes the new content/angle you want<br/>
                  • The result will match the style of your reference but show new content<br/>
                  • Best for creating variations in the same visual style
                </Typography>
              </>
            )}
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

      {/* Help Dialog */}
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Help color="primary" />
            How to Use Advanced Settings
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="h6" gutterBottom color="primary">
              🎯 Understanding Fusion Methods
            </Typography>
            
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    <AutoAwesome /> Blend Fusion (Default)
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>How it works:</strong> All your reference images are blended together, then your prompt is applied to create the final image.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ✅ <strong>Best for:</strong> Combining multiple references<br/>
                    ✅ <strong>Use when:</strong> You want elements from all images<br/>
                    ✅ <strong>Result:</strong> Balanced mix of all references + your prompt
                  </Typography>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, height: '100%', borderColor: 'primary.main' }}>
                  <Typography variant="h6" gutterBottom color="primary">
                    <AutoAwesome color="primary" /> Reference Style Transfer (Advanced)
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>How it works:</strong> Uses the first image for style/theme, then applies your prompt to create new content in that style.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ✅ <strong>Best for:</strong> Style consistency<br/>
                    ✅ <strong>Use when:</strong> You want the same style but different content<br/>
                    ✅ <strong>Result:</strong> New content in the style of your first reference
                  </Typography>
                </Card>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />
            
            <Typography variant="h6" gutterBottom color="primary">
              🎛️ Parameter Settings Guide
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    💪 Strength (0.1 - 1.0)
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Controls how much your reference images influence the result.
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="success.main">
                      <strong>0.1-0.3:</strong> Light blending - subtle changes
                    </Typography>
                    <Typography variant="body2" color="info.main">
                      <strong>0.4-0.6:</strong> Balanced - good mix (recommended)
                    </Typography>
                    <Typography variant="body2" color="warning.main">
                      <strong>0.7-0.9:</strong> Strong - heavy reference influence
                    </Typography>
                    <Typography variant="body2" color="error.main">
                      <strong>1.0:</strong> Maximum - strongest influence
                    </Typography>
                  </Box>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    🎯 Guidance Scale (1.0 - 20.0)
                  </Typography>
                  <Typography variant="body2" paragraph>
                    How closely the AI follows your prompt vs. being creative.
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="success.main">
                      <strong>1.0-5.0:</strong> Creative - more artistic freedom
                    </Typography>
                    <Typography variant="body2" color="info.main">
                      <strong>6.0-10.0:</strong> Balanced - good mix (recommended)
                    </Typography>
                    <Typography variant="body2" color="warning.main">
                      <strong>11.0-15.0:</strong> Strict - closely follows prompt
                    </Typography>
                    <Typography variant="body2" color="error.main">
                      <strong>16.0-20.0:</strong> Very strict - maximum adherence
                    </Typography>
                  </Box>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    ⚡ Inference Steps (20 - 100)
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Number of processing steps - more steps = better quality but slower.
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="success.main">
                      <strong>20-30:</strong> Fast - quick results, lower quality
                    </Typography>
                    <Typography variant="body2" color="info.main">
                      <strong>35-60:</strong> Good balance - recommended
                    </Typography>
                    <Typography variant="body2" color="warning.main">
                      <strong>65-80:</strong> High quality - slower generation
                    </Typography>
                    <Typography variant="body2" color="error.main">
                      <strong>85-100:</strong> Maximum quality - very slow
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom color="primary">
              🚀 Recommended Settings for Different Use Cases
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, borderColor: 'success.main' }}>
                  <Typography variant="h6" gutterBottom color="success.main">
                    🎨 Style Transfer
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Goal:</strong> Keep the style of your reference but change the content
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Method:</strong> Reference Style Transfer<br/>
                    <strong>Strength:</strong> 0.7-0.9<br/>
                    <strong>Guidance:</strong> 7.0-9.0<br/>
                    <strong>Steps:</strong> 50-70
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, borderColor: 'info.main' }}>
                  <Typography variant="h6" gutterBottom color="info.main">
                    🔄 Creative Blending
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Goal:</strong> Combine elements from multiple references
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Method:</strong> Blend Fusion<br/>
                    <strong>Strength:</strong> 0.5-0.7<br/>
                    <strong>Guidance:</strong> 6.0-8.0<br/>
                    <strong>Steps:</strong> 40-60
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, borderColor: 'warning.main' }}>
                  <Typography variant="h6" gutterBottom color="warning.main">
                    ⚡ Fast Iteration
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Goal:</strong> Quick testing of ideas and concepts
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Method:</strong> Blend Fusion<br/>
                    <strong>Strength:</strong> 0.6-0.8<br/>
                    <strong>Guidance:</strong> 7.0-9.0<br/>
                    <strong>Steps:</strong> 25-35
                  </Typography>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, borderColor: 'error.main' }}>
                  <Typography variant="h6" gutterBottom color="error.main">
                    🏆 High Quality Output
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Goal:</strong> Best possible quality for final results
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Method:</strong> Either<br/>
                    <strong>Strength:</strong> 0.6-0.8<br/>
                    <strong>Guidance:</strong> 8.0-10.0<br/>
                    <strong>Steps:</strong> 70-90
                  </Typography>
                </Card>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom color="primary">
              💡 Pro Tips
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Start Simple:</strong> Begin with default settings and adjust based on results
              </Typography>
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" component="div">
                  <strong>🎯 Quick Tips:</strong>
                  <ul>
                    <li>Higher strength = more reference influence</li>
                    <li>Higher guidance = more prompt-following</li>
                    <li>More steps = better quality but slower</li>
                    <li>Reference mode for style consistency</li>
                    <li>Blend mode for combining multiple references</li>
                  </ul>
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="body2" component="div">
                  <strong>⚠️ Common Mistakes:</strong>
                  <ul>
                    <li>Setting strength too high (over 0.9)</li>
                    <li>Using too many steps for testing</li>
                    <li>Not considering fusion method for your goal</li>
                    <li>Setting guidance too low for specific results</li>
                  </ul>
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setHelpOpen(false);
              setSettingsOpen(true);
            }}
          >
            Open Advanced Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImageFusion; 