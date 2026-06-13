import { createTheme } from '@mui/material/styles';

import { brandColors, brandEffects, brandShape, brandTypography } from './brand-tokens';

const { red, black, white, gray } = brandColors;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: red.primary,
      light: red.light,
      dark: red.dark,
      contrastText: white,
    },
    secondary: {
      main: gray[400],
      light: '#8A8C8E',
      dark: '#4A4C4E',
      contrastText: white,
    },
    error: {
      main: red.primary,
      light: red.light,
      dark: red.dark,
      contrastText: white,
    },
    text: {
      primary: black,
      secondary: gray[400],
    },
    background: {
      default: gray[50],
      paper: white,
    },
    divider: gray[200],
    grey: {
      50: gray[50],
      100: gray[100],
      200: gray[200],
      400: gray[400],
      500: gray[500],
      900: gray[900],
    },
  },
  typography: {
    fontFamily: brandTypography.fontFamily,
    body1: {
      lineHeight: 1.6,
    },
    body2: {
      lineHeight: 1.5,
    },
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
      fontSize: '0.75rem',
    },
  },
  shape: {
    borderRadius: brandShape.radiusSm,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: gray[50],
        },
        a: {
          color: red.primary,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: brandShape.radiusButton,
          padding: '12px 22px',
          fontWeight: 700,
          textTransform: 'none',
          transition: brandEffects.transitionFast,
        },
        containedPrimary: {
          border: `1px solid ${red.primary}`,
          '&:hover': {
            backgroundColor: white,
            color: red.primary,
            borderColor: red.primary,
            boxShadow: 'none',
          },
          '&:focus-visible': {
            boxShadow: brandEffects.focusRing,
          },
        },
        outlinedPrimary: {
          borderWidth: 1,
          '&:hover': {
            backgroundColor: red.primary,
            color: white,
            borderColor: red.primary,
          },
        },
        textPrimary: {
          '&:hover': {
            backgroundColor: red.wash,
          },
        },
      },
    },
    MuiLink: {
      defaultProps: {
        underline: 'hover',
      },
      styleOverrides: {
        root: {
          color: red.primary,
          fontWeight: 500,
          transition: brandEffects.transitionFast,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        color: 'default',
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: white,
          color: black,
          boxShadow: brandEffects.headerShadow,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 64,
          '@media (min-width: 0px)': {
            minHeight: 64,
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        outlined: {
          borderColor: gray[200],
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          borderColor: gray[200],
          borderRadius: brandShape.radiusSm,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: brandShape.radiusSm,
          backgroundColor: white,
          transition: brandEffects.transitionFast,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: gray[400],
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: red.primary,
            borderWidth: 1,
          },
        },
        notchedOutline: {
          borderColor: gray[200],
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          '&.Mui-focused': {
            color: red.primary,
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 0,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: brandShape.radiusSm,
          fontWeight: 500,
        },
      },
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          '&.Mui-active': {
            color: red.primary,
            fontWeight: 600,
          },
          '&.Mui-completed': {
            color: gray[900],
          },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          '&.Mui-active': {
            color: red.primary,
          },
          '&.Mui-completed': {
            color: red.primary,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardError: {
          backgroundColor: red.wash,
          color: black,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          textTransform: 'none',
          fontSize: '1rem',
          '&.Mui-selected': {
            color: red.primary,
            fontWeight: 600,
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: gray[200],
        },
      },
    },
  },
});

export {
  brandColors,
  brandEffects,
  brandShape,
  brandSpacing,
  brandTypography,
} from './brand-tokens';
