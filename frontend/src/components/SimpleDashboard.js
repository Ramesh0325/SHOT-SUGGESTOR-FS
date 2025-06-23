import React from 'react';
import { Container, Box, Typography } from '@mui/material';

const SimpleDashboard = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Simple Dashboard Test
        </Typography>
        <Typography variant="body1">
          This is a test dashboard to verify imports work.
        </Typography>
      </Box>
    </Container>
  );
};

export default SimpleDashboard;
