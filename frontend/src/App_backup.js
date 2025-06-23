import React from 'react';
import { createBrowserRouter, RouterProvider, useRouteError, isRouteErrorResponse, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Typography, Box, Button } from '@mui/material';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Layout from './components/layout/Layout';
import Dashboard from './components/Dashboard';
import Projects from './components/projects/Projects';
import ProjectDetail from './components/projects/ProjectDetail';
import Sessions from './components/sessions/Sessions';
import ShotOutputPage from './ShotOutputPage';
import ImageFusion from './components/fusion/ImageFusion_new';
import productionTheme from './theme/productionTheme';

// Error Page Component
const ErrorPage = () => {
  const error = useRouteError();

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom color="error">
          Oops! Something went wrong
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          {isRouteErrorResponse(error)
            ? `Error ${error.status}: ${error.statusText}`
            : error instanceof Error
            ? error.message
            : 'An unexpected error occurred'}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => window.location.href = '/'}
          sx={{ mt: 2 }}
        >
          Go Home
        </Button>
      </Box>
    </Container>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Create router with future flags
const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout>
          <Navigate to="/dashboard" replace />
        </Layout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />
  },
  {
    path: '/login',
    element: <Login />,
    errorElement: <ErrorPage />
  },
  {
    path: '/register',
    element: <Register />,
    errorElement: <ErrorPage />
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Layout>
          <Dashboard />
        </Layout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />
  },
  {
    path: '/projects',
    element: (
      <ProtectedRoute>
        <Layout>
          <Projects />
        </Layout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />
  },
  {
    path: '/projects/:projectId',
    element: (
      <ProtectedRoute>
        <Layout>
          <ProjectDetail />
        </Layout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />
  },
  {
    path: '/sessions',
    element: (
      <ProtectedRoute>
        <Layout>
          <Sessions />
        </Layout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />
  },
  {
    path: '/shot-output',
    element: (
      <ProtectedRoute>
        <Layout>
          <ShotOutputPage />
        </Layout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />
  },
  {
    path: '/image-fusion',
    element: (
      <ProtectedRoute>
        <Layout>
          <ImageFusion />
        </Layout>
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />
  }
], {
  future: {
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_relativeSplatPath: true,
    v7_skipActionErrorRevalidation: true
  }
});

function App() {
  return (
    <ThemeProvider theme={productionTheme}>
      <CssBaseline />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
