import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  DialogContentText
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const Projects = ({ projectType = "shot-suggestion", onProjectSelect, hideHeader = false }) => {
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', project_type: projectType });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, [projectType]);
  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8000/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter projects by type
      const filteredProjects = response.data.filter(project => 
        (project.project_type || 'shot-suggestion') === projectType
      );
      setProjects(filteredProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };
  const handleCreateProject = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:8000/projects', 
        {
          name: newProject.name,
          description: newProject.description,
          project_type: projectType
        },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setOpen(false);
      setNewProject({ name: '', description: '', project_type: projectType });
      fetchProjects();
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    }
  };

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:8000/projects/${projectToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {!hideHeader && (
        <Box sx={{ mb: 4, textAlign: 'center', minHeight: { xs: 100, md: 140 }, py: { xs: 3, md: 5 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h3" fontWeight="bold" sx={{ mb: 1 }}>
            {projectType === 'image-fusion' ? 'Image Fusion Studio' : 'Shot Suggestion Studio'}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.92 }}>
            {projectType === 'image-fusion'
              ? 'Create new perspectives and blend reference images with AI-powered fusion.'
              : 'Create professional shot suggestions with AI-powered scene analysis'}
          </Typography>
        </Box>
      )}
      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AddIcon sx={{ mr: 1 }} />
              <Typography variant="h5" component="h2">
                Create New {projectType === 'image-fusion' ? 'Image Fusion' : 'Shot Suggestion'} Project
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Start a new project to {projectType === 'image-fusion' ? 'blend reference images with your creative vision' : 'generate and organize your shots'}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setOpen(true)}
              fullWidth
            >
              Create New Project
            </Button>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
            <Typography variant="h5" component="h2" gutterBottom>
              My {projectType === 'image-fusion' ? 'Image Fusion' : 'Shot Suggestion'} Projects
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {projects.length === 0 
                ? `You haven't created any ${projectType === 'image-fusion' ? 'image fusion' : 'shot suggestion'} projects yet. Create your first project to get started!`
                : `Select a project to ${projectType === 'image-fusion' ? 'start blending images' : 'view and manage its shots'}`}
            </Typography>
            <Grid container spacing={3}>
              {projects.map((project) => (
                <Grid item xs={12} sm={6} key={project.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': {
                        boxShadow: 6,
                        cursor: 'pointer'
                      }
                    }}
                  >
                    <CardContent 
                      onClick={() => {
                        if (onProjectSelect) {
                          onProjectSelect(project);
                        } else {
                          // Navigate based on project type
                          if (projectType === 'image-fusion') {
                            navigate(`/image-fusion?projectId=${project.id}`);
                          } else {
                            navigate(`/shot-suggestor?projectId=${project.id}`);
                          }
                        }
                      }}
                      sx={{ flexGrow: 1, cursor: 'pointer' }}
                    >
                      <Typography variant="h6" component="h3" gutterBottom>
                        {project.name}
                      </Typography>
                      <Typography color="textSecondary" gutterBottom>
                        {project.description || 'No description'}
                      </Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Created: {new Date(project.created_at).toLocaleDateString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Shots: {project.shot_count || 0}
                      </Typography>
                      {project.last_shot_date && (
                        <Typography variant="body2" color="text.secondary">
                          Last Shot: {new Date(project.last_shot_date).toLocaleDateString()}
                        </Typography>
                      )}
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                      <Tooltip title="Delete Project">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteClick(project);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
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
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            required
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            error={!newProject.name}
            helperText={!newProject.name ? 'Project name is required' : ''}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateProject} 
            color="primary"
            disabled={!newProject.name}
          >
            Create Project
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Projects; 