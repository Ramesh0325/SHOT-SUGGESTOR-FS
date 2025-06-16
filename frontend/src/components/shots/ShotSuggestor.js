import React, { useState } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Paper,
  CircularProgress,
  Divider
} from '@mui/material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const ShotSuggestor = () => {
  const [sceneDescription, setSceneDescription] = useState('');
  const [numShots, setNumShots] = useState(5);
  const [modelName, setModelName] = useState('runwayml/stable-diffusion-v1-5');
  const [suggestedShots, setSuggestedShots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedShot, setSelectedShot] = useState(null);
  const { user } = useAuth();

  const handleSuggestShots = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:8000/shots/suggest',
        {
          scene_description: sceneDescription,
          num_shots: numShots,
          model_name: modelName
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.suggestions) {
        setSuggestedShots(response.data.suggestions);
      } else {
        console.error('Invalid response format:', response.data);
      }
    } catch (error) {
      console.error('Error suggesting shots:', error);
      if (error.response) {
        console.error('Error details:', error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async (shot) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('shot_description', shot.description);
      formData.append('model_name', modelName);

      const response = await axios.post('http://localhost:8000/shots/generate-image', formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.image_url) {
        setSelectedShot({ ...shot, image_url: response.data.image_url });
        setOpen(true);
      } else {
        console.error('Invalid response format:', response.data);
      }
    } catch (error) {
      console.error('Error generating image:', error);
      if (error.response) {
        console.error('Error details:', error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNumShotsChange = (event, newValue) => {
    setNumShots(newValue);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
        {/* Left Panel - Shot Suggestions */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Shot Suggestor
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="Scene Description"
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography gutterBottom>Number of Shots</Typography>
                <Slider
                  value={numShots}
                  onChange={handleNumShotsChange}
                  min={1}
                  max={10}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                />
                <Typography variant="body2" color="text.secondary" align="center">
                  {numShots} shots
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleSuggestShots}
                  disabled={loading || !sceneDescription}
                  fullWidth
                >
                  {loading ? <CircularProgress size={24} /> : 'Suggest Shots'}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {suggestedShots.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Suggested Shots
              </Typography>
              {suggestedShots.map((shot, index) => (
                <Card key={index} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Shot {shot.shot_number}
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {shot.description}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2">Camera Angle</Typography>
                        <Typography variant="body2">{shot.camera_angle}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2">Camera Movement</Typography>
                        <Typography variant="body2">{shot.camera_movement}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2">Lighting</Typography>
                        <Typography variant="body2">{shot.lighting}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2">Visual Elements</Typography>
                        <Typography variant="body2">{shot.visual_elements}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2">Emotional Impact</Typography>
                        <Typography variant="body2">{shot.emotional_impact}</Typography>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 2 }}>
                      <Button
                        variant="outlined"
                        onClick={() => handleGenerateImage(shot)}
                        disabled={loading}
                      >
                        {loading ? <CircularProgress size={24} /> : 'Generate Image'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Paper>
          )}
        </Box>

        {/* Right Panel - Generated Images */}
        {suggestedShots.some(shot => shot.image_url) && (
          <Box sx={{ width: '400px', position: 'sticky', top: 24, alignSelf: 'flex-start' }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Generated Images
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {suggestedShots.map((shot, index) => (
                shot.image_url && (
                  <Box key={index} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Shot {shot.shot_number}
                    </Typography>
                    <Card>
                      <CardMedia
                        component="img"
                        image={shot.image_url}
                        alt={`Shot ${shot.shot_number}`}
                        sx={{ 
                          height: 300,
                          objectFit: 'cover'
                        }}
                      />
                    </Card>
                  </Box>
                )
              ))}
            </Paper>
          </Box>
        )}
      </Box>

      {/* Image Preview Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Shot {selectedShot?.shot_number} Preview
        </DialogTitle>
        <DialogContent>
          {selectedShot?.image_url && (
            <img
              src={selectedShot.image_url}
              alt={`Shot ${selectedShot.shot_number}`}
              style={{ width: '100%', height: 'auto' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ShotSuggestor; 