import { Theme } from '@mui/material/styles';

export const globalStyles = (theme: Theme) => ({
  '*': {
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '&::-webkit-scrollbar-track': {
      background: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.05)',
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
      background: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(0, 0, 0, 0.2)',
      borderRadius: '4px',
      '&:hover': {
        background: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.3)'
          : 'rgba(0, 0, 0, 0.3)',
      },
    },
  },
  'html, body': {
    width: '100%',
    height: '100%',
    fontFamily: theme.typography.fontFamily,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    overflowX: 'hidden',
  },
  '#root': {
    width: '100%',
    height: '100%',
  },
  a: {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  button: {
    fontFamily: theme.typography.fontFamily,
  },
  '.MuiDialog-paper': {
    margin: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(1),
    },
  },
  '.MuiDialogContent-root': {
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '&::-webkit-scrollbar-track': {
      background: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.05)',
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
      background: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.2)'
        : 'rgba(0, 0, 0, 0.2)',
      borderRadius: '4px',
      '&:hover': {
        background: theme.palette.mode === 'dark'
          ? 'rgba(255, 255, 255, 0.3)'
          : 'rgba(0, 0, 0, 0.3)',
      },
    },
  },
  '.MuiPaper-root': {
    backgroundImage: 'none',
  },
  '.MuiButton-root': {
    textTransform: 'none',
    fontWeight: 500,
  },
  '.MuiTypography-root': {
    marginBottom: 0,
  },
  '.MuiInputBase-root': {
    transition: theme.transitions.create(['border-color', 'box-shadow']),
  },
  '.MuiOutlinedInput-root': {
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.mode === 'dark'
        ? 'rgba(255, 255, 255, 0.3)'
        : 'rgba(0, 0, 0, 0.3)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderWidth: 2,
    },
  },
  '.MuiSelect-select': {
    '&:focus': {
      backgroundColor: 'transparent',
    },
  },
  '.MuiCheckbox-root': {
    padding: theme.spacing(0.5),
  },
  '.MuiSwitch-root': {
    padding: theme.spacing(1),
  },
  '.MuiCardContent-root': {
    '&:last-child': {
      paddingBottom: theme.spacing(2),
    },
  },
  '.MuiStepLabel-root': {
    '.MuiStepLabel-label': {
      marginTop: theme.spacing(0.5),
    },
  },
  '.MuiAlert-root': {
    alignItems: 'center',
  },
  '.MuiTooltip-tooltip': {
    fontSize: '0.75rem',
    padding: theme.spacing(0.5, 1),
  },
  '.MuiBackdrop-root': {
    backdropFilter: 'blur(4px)',
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(0, 0, 0, 0.8)'
      : 'rgba(255, 255, 255, 0.8)',
  },
  '.MuiPopover-paper, .MuiMenu-paper': {
    boxShadow: theme.shadows[4],
  },
  '.MuiTableCell-root': {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  '.MuiTableRow-root': {
    '&:last-child .MuiTableCell-root': {
      borderBottom: 'none',
    },
  },
  '.MuiLinearProgress-root': {
    borderRadius: theme.shape.borderRadius,
  },
  '.MuiCircularProgress-root': {
    transition: theme.transitions.create(['color']),
  },
  '.MuiSkeleton-root': {
    transform: 'scale(1)',
  },
});

export default globalStyles; 