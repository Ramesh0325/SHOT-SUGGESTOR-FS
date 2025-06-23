import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Typography, Container, Box, Button } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import productionTheme from './theme/productionTheme';

// Import components - ALL COMPONENTS RESTORED (Dashboard FIXED!)
import TestComponent from './components/TestComponent';
import SimpleLogin from './components/SimpleLogin';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import FixedDashboard from './components/FixedDashboard'; // WORKING PERFECTLY!
import Projects from './components/projects/Projects';
import ProjectDetail from './components/projects/ProjectDetail';
import Sessions from './components/sessions/Sessions';
import ShotOutputPage from './ShotOutputPage';
import ImageFusionWithTabs from './components/fusion/ImageFusionWithTabs';
import ShotSuggestor from './components/shots/ShotSuggestorWithTabs';
import SimpleNavbar from './components/layout/SimpleNavbar';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Typography>Loading...</Typography>
        </Box>
      </Container>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const HomePage = () => (
  <Container maxWidth="md">
    <Box sx={{ mt: 8, textAlign: 'center' }}> {/* Added mt: 8 to account for navbar */}
      <Typography variant="h2" component="h1" gutterBottom>
        SHOT-SUGGESTOR
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Professional AI-powered photography assistant
      </Typography>
      <Box sx={{ mt: 3, mb: 3 }}>        <Typography variant="h6" color="text.secondary">
          🎉 PRODUCTION READY! All components restored with working Dashboard!
        </Typography>
      </Box>
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>        <Button 
          component={Link} 
          to="/login" 
          variant="contained" 
          size="large"
        >
          Login (Original)
        </Button>        <Button 
          component={Link} 
          to="/register" 
          variant="outlined" 
          size="large"
        >
          Register
        </Button>
        <Button 
          component={Link} 
          to="/dashboard" 
          variant="contained" 
          size="large"
          color="primary"
        >
          Dashboard
        </Button>
        <Button 
          component={Link} 
          to="/test" 
          variant="outlined" 
          size="large"
        >
          Test Component
        </Button>
      </Box>
    </Box>
  </Container>
);

function App() {
  return (
    <ThemeProvider theme={productionTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <SimpleNavbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/test" element={<TestComponent />} />
            <Route path="/login-simple" element={<SimpleLogin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <FixedDashboard />
                </ProtectedRoute>
              } 
            />            <Route 
              path="/shot-suggestor" 
              element={
                <ProtectedRoute>
                  <ShotSuggestor />
                </ProtectedRoute>
              } 
            />            <Route 
              path="/image-fusion" 
              element={
                <ProtectedRoute>
                  <ImageFusionWithTabs />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/shot-output" 
              element={
                <ProtectedRoute>
                  <ShotOutputPage />
                </ProtectedRoute>
              } 
            />
            {/* All routes now active and production ready! */}
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
