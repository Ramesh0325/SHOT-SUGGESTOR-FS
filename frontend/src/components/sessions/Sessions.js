import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
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
  const handleViewSession = async (sessionId, sessionType) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:8000/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { session_type: sessionType }
      });
      setSelectedSession(response.data);
      setOpen(true);
    } catch (error) {
      console.error('Error fetching session details:', error);
    }
  };
  
  // Format the date from ISO string
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        My Sessions
      </Typography>      <Paper elevation={2}>
        <List>
          {sessions.length === 0 ? (
            <ListItem>
              <ListItemText primary="No sessions found" />
            </ListItem>
          ) : (
            sessions.map((session) => (
              <ListItem
                key={`${session.type}-${session.id || session.name}`}
                button
                onClick={() => handleViewSession(session.name || session.id, session.type)}
                sx={{
                  borderLeft: session.type === 'filesystem' ? '3px solid #4caf50' : '3px solid #2196f3',
                  mb: 1
                }}
              >                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center">
                      <span>{session.name}</span>
                    </Box>
                  }
                  secondary={
                    <>
                      {`Created: ${new Date(session.created_at).toLocaleString()}`}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Link 
                    to={`/shot-output/${session.id}`} 
                    state={{ 
                      sessionId: session.id,
                      sessionType: session.type
                    }}
                    style={{ textDecoration: 'none', marginRight: '10px' }}
                  >
                    <Button size="small" variant="outlined" color="primary">
                      View in Shot Output
                    </Button>
                  </Link>
                  
                  {session.type === 'database' && (
                    <>
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
                    </>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </Paper>

      <Dialog 
        open={open} 
        onClose={() => {
          setOpen(false);
          setEditMode(false);
          setSelectedSession(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editMode ? 'Rename Session' : 'Session Details'}
          {selectedSession && !editMode && (
            <Typography variant="subtitle2" color="textSecondary">
              {selectedSession.type === 'filesystem' 
                ? <Box display="flex" alignItems="center"><FolderIcon fontSize="small" sx={{ mr: 1 }}/> File System Session ({selectedSession.name})</Box> 
                : <Box display="flex" alignItems="center"><StorageIcon fontSize="small" sx={{ mr: 1 }}/> Database Session ({selectedSession.name})</Box>}
            </Typography>
          )}
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
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Created: {new Date(selectedSession.created_at).toLocaleString()}
              </Typography>
              
              {selectedSession.type === 'filesystem' && selectedSession.folder_path && (
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                  Path: {selectedSession.folder_path}
                </Typography>
              )}
              
              {/* Show shots data if available */}
              {selectedSession.data && selectedSession.data.shots && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom>Shots</Typography>
                  <Paper elevation={1} sx={{ p: 2, mb: 3, maxHeight: '300px', overflow: 'auto' }}>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedSession.data.shots, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
              
              {/* Show input data if available */}
              {selectedSession.data && selectedSession.data.input && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom>Input Data</Typography>
                  <Paper elevation={1} sx={{ p: 2, maxHeight: '300px', overflow: 'auto' }}>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedSession.data.input, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
              
              {/* If there's data but no shots or input objects */}
              {selectedSession.data && !selectedSession.data.shots && !selectedSession.data.input && (
                <Box mt={3}>
                  <Typography variant="h6" gutterBottom>Session Data</Typography>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(selectedSession.data, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>        <DialogActions>
          <Button onClick={() => {
            setOpen(false);
            setEditMode(false);
            setSelectedSession(null);
          }}>
            {editMode ? 'Cancel' : 'Close'}
          </Button>
          {!editMode && selectedSession && selectedSession.data && selectedSession.data.shots && (
            <Button 
              component={Link} 
              to={`/shot-output/${selectedSession.id}`}
              state={{ 
                shotData: selectedSession.data.shots, 
                inputData: selectedSession.data.input 
              }}
              color="primary"
              variant="contained"
            >
              View in Shot Output
            </Button>
          )}
          {editMode && selectedSession && selectedSession.type === 'database' && (
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