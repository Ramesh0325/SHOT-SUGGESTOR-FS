import { createTheme } from '@mui/material/styles';

// Professional production-level design system with consistent branding
const productionTheme = createTheme({
  palette: {
    primary: {
      main: '#37474f', // Matching Login component theme
      light: '#62727b',
      dark: '#102027',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#455a64', // Professional blue-gray
      light: '#718792',
      dark: '#1c313a',
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafafa', // Matching Login gradient start
      paper: '#ffffff',
    },
    text: {
      primary: '#37474f', // Consistent with primary
      secondary: '#78909c', // Matching Login secondary text
    },
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
    success: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
    },
    warning: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
      dark: '#d32f2f',
    },    info: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '-0.025em',
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.35,
    },
    h5: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: '#37474f',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      color: '#78909c',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      fontSize: '1rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 2px 4px rgba(0,0,0,0.04)',
    '0 4px 8px rgba(0,0,0,0.06)',
    '0 8px 16px rgba(0,0,0,0.08)',
    '0 12px 24px rgba(0,0,0,0.10)',
    '0 16px 32px rgba(0,0,0,0.12)',
    '0 20px 40px rgba(0,0,0,0.14)',
    '0 24px 48px rgba(0,0,0,0.16)',
    '0 32px 64px rgba(0,0,0,0.18)',
    '0 40px 80px rgba(0,0,0,0.20)',    '0 48px 96px rgba(0,0,0,0.22)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: 500,
          textTransform: 'none',
          boxShadow: 'none',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          },
        },
        containedPrimary: {
          background: '#455a64',
          color: 'white',
          '&:hover': {
            background: '#37474f',
          },
        },
        containedSecondary: {
          background: '#78909c',
          color: 'white',
          '&:hover': {
            background: '#607d8b',
          },
        },
        outlined: {
          borderColor: '#e0e0e0',
          '&:hover': {
            borderColor: '#455a64',
            background: 'rgba(69, 90, 100, 0.04)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            transform: 'translateY(-4px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        },
        elevation2: {
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        },
        elevation3: {
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#78909c',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#455a64',
              borderWidth: '2px',
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: '#455a64',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        },
        outlined: {
          borderColor: 'rgba(69, 90, 100, 0.3)',
          '&:hover': {
            borderColor: '#455a64',
            background: 'rgba(69, 90, 100, 0.04)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          color: '#37474f',
          boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          padding: '8px',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 0',
          '&:hover': {
            background: 'rgba(69, 90, 100, 0.04)',
          },
        },
      },
    },
  },
});

export default productionTheme;
