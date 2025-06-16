import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Paper
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const Sessions = () => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newName, setNewName] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8000/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const handleDeleteSession = async (sessionName) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:8000/sessions/${sessionName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const handleRenameSession = async () => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('old_name', selectedSession.name);
      formData.append('new_name', newName);

      await axios.post('http://localhost:8000/sessions/rename', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setOpen(false);
      setEditMode(false);
      setNewName('');
      fetchSessions();
    } catch (error) {
      console.error('Error renaming session:', error);
    }
  };

  const handleViewSession = async (sessionName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/sessions/${sessionName}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedSession(response.data);
      setOpen(true);
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        My Sessions
      </Typography>

      <Paper elevation={2}>
        <List>
          {sessions.map((session) => (
            <ListItem
              key={session.name}
              button
              onClick={() => handleViewSession(session.name)}
            >
              <ListItemText
                primary={session.name}
                secondary={`Created: ${new Date(session.created_at).toLocaleString()}`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label="edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSession(session);
                    setNewName(session.name);
                    setEditMode(true);
                    setOpen(true);
                  }}
                  sx={{ mr: 1 }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.name);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>

      <Dialog open={open} onClose={() => {
        setOpen(false);
        setEditMode(false);
        setSelectedSession(null);
      }}>
        <DialogTitle>
          {editMode ? 'Rename Session' : 'Session Details'}
        </DialogTitle>
        <DialogContent>
          {editMode ? (
            <TextField
              autoFocus
              margin="dense"
              label="Session Name"
              fullWidth
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          ) : selectedSession && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6">Session Data</Typography>
              <pre style={{ whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(selectedSession.data, null, 2)}
              </pre>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpen(false);
            setEditMode(false);
            setSelectedSession(null);
          }}>
            Close
          </Button>
          {editMode && (
            <Button onClick={handleRenameSession} color="primary">
              Save
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Sessions; 