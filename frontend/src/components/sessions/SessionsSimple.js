import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';

const Sessions = ({ projectType = "shot-suggestion", projectId = null }) => {
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        📁 Project Sessions
      </Typography>
      
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          Sessions component is working
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Project Type: {projectType}
        </Typography>
        {projectId && (
          <Typography variant="body2" color="textSecondary">
            Project ID: {projectId}
          </Typography>
        )}
      </Paper>
    </Container>
  );
};

export default Sessions;
