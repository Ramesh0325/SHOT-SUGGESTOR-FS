import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, List, ListItem, ListItemText, CircularProgress, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import axios from 'axios';
import { BACKEND_HOST } from '../../config';

const Sessions = ({ projectType = "shot-suggestion", projectId = null }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchSessions();
    }
  }, [projectId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_HOST}/projects/${projectId}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(response.data || []);
    } catch (error) {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (session) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${BACKEND_HOST}/projects/${projectId}/sessions/${sessionToDelete.name}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
      fetchSessions();
    } catch (error) {
      alert('Failed to delete session');
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        📁 Project Sessions
      </Typography>
      <Paper sx={{ p: 4 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : sessions.length === 0 ? (
          <Typography color="textSecondary" align="center">
            No sessions found for this project. Generate shot suggestions to create a new session.
          </Typography>
        ) : (
          <List>
            {sessions.map((session) => (
              <ListItem
                key={session.id}
                button
                divider
                onClick={() => navigate(`/shot-output/${session.id}`, { state: { sessionId: session.id, projectId } })}
              >
                <ListItemText
                  primary={session.name || session.id}
                  secondary={
                    <>
                      <Typography variant="body2" component="span" color="textSecondary">
                        Created: {new Date(session.created_at).toLocaleString()}
                      </Typography>
                      <br />
                      {session.has_shots && <Chip label="Has shots" color="success" size="small" sx={{ mr: 1 }} />}
                      {session.has_input && <Chip label="Has input" color="info" size="small" />}
                    </>
                  }
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={e => {
                    e.stopPropagation();
                    navigate(`/shot-output/${session.id}`, { state: { sessionId: session.id, projectId } });
                  }}
                >
                  View Output
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteSession(session);
                  }}
                >
                  Delete
                </Button>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Session</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this session? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteSession} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Sessions;
