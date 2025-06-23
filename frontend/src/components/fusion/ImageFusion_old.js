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
  Help,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const ImageFusion = () => {
  const auth = useAuth();
  const token = auth?.token;
  const [referenceImages, setReferenceImages] = useState([]);  const [imageAnalyses, setImageAnalyses] = useState([]); // Store analysis results
  const [analysisLoading, setAnalysisLoading] = useState(false); // Loading state for analysis
  const [analysisComplete, setAnalysisComplete] = useState(false); // Whether analysis is done
  const [expandedDescriptions, setExpandedDescriptions] = useState(new Set()); // Track which descriptions are expanded
  const [combinedPrompt, setCombinedPrompt] = useState(''); // Preview of combined prompt
  const [combinedPromptData, setCombinedPromptData] = useState(null); // Full combined prompt data
  const [promptPreviewLoading, setPromptPreviewLoading] = useState(false); // Loading for prompt preview
  const [showCombinedPrompt, setShowCombinedPrompt] = useState(false); // Whether to show combined prompt
  const [currentStep, setCurrentStep] = useState(1); // Track workflow step: 1=upload, 2=analyze, 3=prompt, 4=preview, 5=generate
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState('');
  const [fusionLoading, setFusionLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);  const [previewOpen, setPreviewOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [progressStep, setProgressStep] = useState(0);
  const fileInputRef = useRef();const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const newImages = files.map(file => ({
      file,
      name: file.name,
      preview: URL.createObjectURL(file)
    }));
    setReferenceImages(prev => [...prev, ...newImages]);
    setError('');
    // Reset all analysis and prompt state when new images are uploaded
    setImageAnalyses([]);
    setAnalysisComplete(false);
    setCombinedPrompt('');
    setCombinedPromptData(null);
    setShowCombinedPrompt(false);
    setCurrentStep(1);
  };  const removeImage = (index) => {
    setReferenceImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      return newImages;
    });
    // Reset all analysis and prompt state when images are removed
    setImageAnalyses([]);
    setAnalysisComplete(false);
    setCombinedPrompt('');
    setCombinedPromptData(null);
    setShowCombinedPrompt(false);
    setCurrentStep(1);
  };

  const handlePreviewImage = (image) => {
    setPreviewImage(image);
    setPreviewOpen(true);
  };  const handleGenerateFusion = async () => {
    if (referenceImages.length === 0) {
      setError('Please upload at least one reference image');
      return;
    }

    if (!analysisComplete) {
      setError('Please analyze your images first by clicking "Analyze Images"');
      return;
    }

    if (!showCombinedPrompt) {
      setError('Please preview the combined prompt first by clicking "Modify"');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a description of the new angle/view');
      return;
    }

    setCurrentStep(5); // Move to generation step

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

      // Add all reference images
      referenceImages.forEach((imageObj) => {
        formData.append('files', imageObj.file);
      });      // Step 2: Sending request
      setProgressStep(2);
      setGenerationProgress('Analyzing reference images...');

      // Use enhanced fusion endpoint
      const endpoint = 'http://localhost:8000/api/enhanced-fusion';
      setGenerationProgress('Analyzing images with AI vision...');

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
        throw new Error(errorData.detail || 'Failed to generate image with new viewpoint');
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

  const handleAnalyzeImages = async () => {
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
      }      const data = await response.json();
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
      }

      const data = await response.json();
      setCombinedPrompt(data.combined_prompt);
      setCombinedPromptData(data);
      setShowCombinedPrompt(true);
      setCurrentStep(4); // Move to preview step

    } catch (err) {
      setError(err.message);
    } finally {
      setPromptPreviewLoading(false);
    }  };

  const toggleDescriptionExpansion = (index) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedDescriptions(newExpanded);
  };

  // Safety check to prevent rendering before auth is ready
  if (!auth) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  return (
    <Box sx={{ p: 2, minHeight: '100vh', width: '100%' }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          🎬 Same World, New Angle
          <Tooltip title="Learn how to use Enhanced Fusion - Upload images, analyze them, enter desired angle, preview prompt, and generate!">
            <IconButton size="small" onClick={() => setHelpOpen(true)}>
              <Help color="primary" />
            </IconButton>
          </Tooltip>
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Workflow Progress Indicator */}
      {referenceImages.length > 0 && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
          <Typography variant="h6" gutterBottom color="primary.main">
            📋 Workflow Progress
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {[
              { step: 1, label: 'Upload Images', icon: '📸', active: referenceImages.length > 0 },
              { step: 2, label: 'Analyze Images', icon: '🔍', active: analysisComplete },
              { step: 3, label: 'Enter Prompt', icon: '🎯', active: currentStep >= 3 },
              { step: 4, label: 'Preview Combined', icon: '📝', active: showCombinedPrompt },
              { step: 5, label: 'Generate', icon: '✨', active: currentStep >= 5 }
            ].map((item, index) => (
              <Box key={index} sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                opacity: item.active ? 1 : 0.4,
                transition: 'opacity 0.3s'
              }}>
                <Typography variant="body2" sx={{ 
                  minWidth: 24, 
                  height: 24, 
                  borderRadius: '50%', 
                  bgcolor: item.active ? 'primary.main' : 'grey.300',
                  color: item.active ? 'white' : 'grey.600',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  {item.step}
                </Typography>
                <Typography variant="body2" sx={{ 
                  fontWeight: item.active ? 'bold' : 'normal',
                  color: item.active ? 'primary.main' : 'text.secondary'
                }}>
                  {item.icon} {item.label}
                </Typography>
                {index < 4 && (
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ flex: 1 }}>
          <strong>Enhanced Fusion:</strong> Upload your reference images, let AI analyze them in detail, then specify your desired angle. 
          The AI preserves every visual element (lighting, colors, objects, style) while creating your new viewpoint. 
          <span style={{ color: 'primary.main', fontWeight: 'bold' }}> Perfect for generating consistent visuals from new angles!</span>
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
      )}      <Grid container spacing={3}>
        {/* Left Panel - Image Upload & Analysis */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
              📸 Step 1: Upload Reference Images
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload 1-5 high-quality images of your scene/object. These images should show the elements you want to preserve (lighting, colors, style, objects, background). The AI will analyze every detail.
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
            
            {/* Image Analysis Section */}
            {referenceImages.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  🔍 Step 2: AI Vision Analysis
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Let our AI analyze your images to extract detailed descriptions of every visual element - lighting, colors, objects, background, style, and atmosphere. This ensures perfect preservation when generating new angles.
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleAnalyzeImages}
                    disabled={analysisLoading || referenceImages.length === 0}
                    startIcon={analysisLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
                    fullWidth
                  >
                    {analysisLoading ? 'Analyzing...' : 'Analyze Images'}
                  </Button>
                  
                  {analysisComplete && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      ✅ Analysis complete! Review descriptions below.
                    </Typography>
                  )}
                </Box>

                {/* Analysis Results */}
                {imageAnalyses.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      📝 AI Vision Analysis Results:
                    </Typography>
                    {imageAnalyses.map((analysis, index) => (
                      <Paper key={index} sx={{ p: 2, mb: 2, border: analysis.status === 'error' ? '1px solid red' : '1px solid green' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          📸 Reference {index + 1}: {analysis.filename}
                        </Typography>
                        
                        {analysis.status === 'success' ? (
                          <>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Dimensions:</strong> {analysis.technical_info.dimensions} | 
                                <strong> Mood:</strong> {analysis.technical_info.overall_mood} | 
                                <strong> Style:</strong> {analysis.technical_info.visual_style}
                              </Typography>
                              <Button
                                size="small"
                                onClick={() => toggleDescriptionExpansion(index)}
                                startIcon={expandedDescriptions.has(index) ? <ExpandLess /> : <ExpandMore />}
                                sx={{ textTransform: 'none' }}
                              >
                                {expandedDescriptions.has(index) ? 'Hide Details' : 'Show Details'}
                              </Button>
                            </Box>
                            
                            {expandedDescriptions.has(index) && (
                              <Typography variant="body2" sx={{ 
                                bgcolor: 'background.paper', 
                                p: 2, 
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                fontFamily: 'monospace',
                                fontSize: '0.85rem',
                                lineHeight: 1.4,
                                maxHeight: 300,
                                overflowY: 'auto',
                                mb: 1
                              }}>
                                {analysis.description}
                              </Typography>
                            )}
                            
                            {!expandedDescriptions.has(index) && (
                              <Typography variant="body2" color="text.secondary" sx={{ 
                                fontStyle: 'italic',
                                mb: 1,
                                p: 1,
                                bgcolor: 'action.hover',
                                borderRadius: 1
                              }}>
                                🔍 AI description extracted ({analysis.description.length} characters) - Click "Show Details" to view
                              </Typography>
                            )}
                            
                            <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                              ✅ This description will be used to preserve all visual elements in your generated image.
                            </Typography>
                          </>
                        ) : (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            ❌ Analysis failed: {analysis.error}
                          </Alert>
                        )}
                      </Paper>
                    ))}
                    
                    <Alert severity="info" sx={{ mt: 2 }}>
                      💡 <strong>Review these descriptions:</strong> The AI will use these detailed analyses to preserve all the visual elements, backgrounds, lighting, and themes when generating your new viewpoint. If any important details are missing, consider uploading different/better quality reference images.
                    </Alert>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Panel - Angle Input & Generation */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
              🎯 Step 3: Specify Your Desired Angle
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Describe the new viewpoint or angle you want to see. Be specific about the camera position, distance, or perspective. The AI will preserve all analyzed elements while creating this new view.
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={6}
              variant="outlined"
              placeholder="Examples: 'side view of the same car', 'close-up from above', 'behind the throne', 'low angle shot', 'bird's eye view', 'from the driver's perspective'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              sx={{ mb: 2 }}
              disabled={!analysisComplete}
            />
            
            {!analysisComplete && referenceImages.length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                📋 Please analyze your images first to enable angle input.
              </Alert>
            )}
            
            {analysisComplete && (
              <Button
                variant="contained"
                color="primary"
                onClick={handlePreviewCombinedPrompt}
                disabled={promptPreviewLoading || !prompt.trim()}
                startIcon={promptPreviewLoading ? <CircularProgress size={20} color="inherit" /> : <AutoAwesome />}
                fullWidth
                sx={{ mb: 2 }}
              >
                {promptPreviewLoading ? 'Creating Combined Prompt...' : 'Create & Preview Combined Prompt'}
              </Button>
            )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              💡 The AI will intelligently merge your request with the analyzed descriptions to create an optimized generation prompt.
            </Typography>

            {/* Step 4: Combined Prompt Preview */}
            {showCombinedPrompt && combinedPromptData && currentStep >= 4 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                  📝 Step 4: Review & Approve Final Prompt
                </Typography>
                
                <Alert severity="info" sx={{ mb: 2 }}>
                  💡 <strong>Review before generating:</strong> This optimized prompt combines your angle request with all visual details from your images. The AI has intelligently merged everything for maximum accuracy.
                </Alert>
                
                {/* Original User Prompt */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                  <Typography variant="subtitle2" gutterBottom color="primary.main">
                    🎯 Your Original Prompt:
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    "{combinedPromptData?.breakdown?.original_user_prompt || prompt}"
                  </Typography>
                </Paper>

                {/* Final Combined Prompt */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: '2px solid', borderColor: 'warning.main' }}>
                  <Typography variant="subtitle2" gutterBottom color="warning.main">
                    🚀 Final Combined Prompt for Generation:
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    lineHeight: 1.4,
                    maxHeight: 200,
                    overflowY: 'auto',
                    bgcolor: 'grey.50',
                    p: 1,
                    borderRadius: 1
                  }}>
                    {combinedPromptData?.combined_prompt || combinedPrompt}
                  </Typography>
                </Paper>

                {/* Generate Button */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  🚀 <strong>Ready to generate?</strong> The AI will now create your new viewpoint while preserving all the analyzed visual elements. This typically takes 30-60 seconds.
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexDirection: 'column' }}>
                  <Button
                    variant="contained"
                    size="large"
                    color="success"
                    onClick={handleGenerateFusion}
                    disabled={fusionLoading}
                    startIcon={fusionLoading ? <CircularProgress size={20} /> : <AutoAwesome />}
                    fullWidth
                  >
                    {fusionLoading ? 'Generating Your Image...' : '✨ Generate New Viewpoint'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setShowCombinedPrompt(false);
                      setCurrentStep(3);
                    }}
                  >
                    ← Edit Prompt
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Panel - Results */}
        {(generatedImage || fusionLoading) && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                🎨 Generated Result
              </Typography>
              
              {/* Progress Indicator */}
              {fusionLoading && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="primary" gutterBottom>
                    {generationProgress}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Step {progressStep}/4
                    </Typography>
                  </Box>
                </Box>
              )}

              {generatedImage && (
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={`data:image/png;base64,${generatedImage}`}
                    alt="Generated fusion"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '600px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<Download />}
                      onClick={handleDownload}
                      sx={{ mr: 2 }}
                    >
                      Download Image
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Clear />}
                      onClick={clearAll}
                    >
                      Start Over
                    </Button>
                  </Box>                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Help Dialog */}
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Help />
            🚀 How Enhanced Fusion Works
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="h6" gutterBottom color="primary">
              � 4-Step Enhanced Fusion Process
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
              Our Enhanced Fusion uses advanced AI to create new viewpoints while preserving every detail from your reference images.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'success.main' }}>
                📋 Step-by-Step Workflow:
              </Typography>
              
              <Box sx={{ ml: 1 }}>
                <Typography variant="body2" sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}>
                  <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold', mr: 1, mt: 0.1 }}>1.</Box>
                  <Box>
                    <strong>Upload Reference Images:</strong> Add 1-5 high-quality images of your scene/object showing the elements you want to preserve (lighting, colors, style, objects, background).
                  </Box>
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}>
                  <Box component="span" sx={{ color: 'success.main', fontWeight: 'bold', mr: 1, mt: 0.1 }}>2.</Box>
                  <Box>
                    <strong>AI Vision Analysis:</strong> Click "Analyze Images" - AI extracts detailed descriptions of lighting, colors, objects, background, style, and atmosphere from each image.
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
                    <strong>Smart Merging & Generation:</strong> AI intelligently combines descriptions with your request, creates an optimized prompt, and generates your new viewpoint.
                  </Box>                </Typography>
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