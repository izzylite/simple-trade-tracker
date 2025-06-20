import { Theme } from '@mui/material/styles';
import { BlogCategory } from '../types/blog';

// Blog-specific theme extensions
export const blogTheme = {
  // Category colors for consistent theming
  categoryColors: {
    [BlogCategory.MARKET_NEWS]: '#1976d2',
    [BlogCategory.TRADING_STRATEGIES]: '#388e3c',
    [BlogCategory.ECONOMIC_INDICATORS]: '#f57c00',
    [BlogCategory.CRYPTOCURRENCY]: '#7b1fa2',
    [BlogCategory.FOREX]: '#303f9f',
    [BlogCategory.STOCKS]: '#d32f2f',
    [BlogCategory.COMMODITIES]: '#795548',
    [BlogCategory.ANALYSIS]: '#455a64',
    [BlogCategory.EDUCATION]: '#00796b',
    [BlogCategory.REGULATION]: '#5d4037'
  },

  // Blog card styles
  card: {
    default: {
      height: 320,
      borderRadius: 2,
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: (theme: Theme) => theme.shadows[8],
      }
    },
    compact: {
      height: 200,
      borderRadius: 2,
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: (theme: Theme) => theme.shadows[4],
      }
    },
    featured: {
      height: 400,
      borderRadius: 3,
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-6px)',
        boxShadow: (theme: Theme) => theme.shadows[12],
      }
    }
  },

  // Blog post dialog styles
  dialog: {
    paper: {
      borderRadius: 2,
      maxHeight: '90vh'
    },
    content: {
      '& p': { 
        marginBottom: 2, 
        lineHeight: 1.7 
      },
      '& h1, & h2, & h3, & h4, & h5, & h6': { 
        marginTop: 3, 
        marginBottom: 2, 
        fontWeight: 600 
      },
      '& ul, & ol': { 
        paddingLeft: 3, 
        marginBottom: 2,
        '& li': { marginBottom: 1 }
      },
      '& blockquote': {
        borderLeft: 4,
        borderColor: 'primary.main',
        paddingLeft: 2,
        marginLeft: 0,
        fontStyle: 'italic',
        color: 'text.secondary'
      },
      '& img': {
        maxWidth: '100%',
        height: 'auto',
        borderRadius: 1
      },
      '& a': {
        color: 'primary.main',
        textDecoration: 'none',
        '&:hover': {
          textDecoration: 'underline'
        }
      }
    }
  },

  // Filter styles
  filters: {
    paper: {
      padding: 2,
      marginBottom: 3,
      borderRadius: 2
    },
    accordion: {
      '&:before': {
        display: 'none'
      },
      boxShadow: 'none',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      '&:not(:last-child)': {
        borderBottom: 0
      },
      '&.Mui-expanded': {
        margin: 0
      }
    }
  },

  // Loading states
  loading: {
    backdrop: {
      zIndex: (theme: Theme) => theme.zIndex.drawer + 1,
      flexDirection: 'column',
      gap: 2
    },
    skeleton: {
      borderRadius: 1,
      animation: 'wave'
    }
  },

  // Error states
  error: {
    fullscreen: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      textAlign: 'center',
      padding: 4
    },
    inline: {
      marginBottom: 3,
      borderRadius: 1
    }
  },

  // Empty states
  empty: {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40vh',
      textAlign: 'center',
      padding: 4
    },
    icon: {
      fontSize: 64,
      color: 'text.secondary',
      marginBottom: 2
    }
  }
};

// Utility functions for blog styling
export const getBlogCategoryColor = (category: BlogCategory): string => {
  return blogTheme.categoryColors[category] || '#757575';
};

export const getBlogCardStyles = (variant: 'default' | 'compact' | 'featured' = 'default') => {
  return blogTheme.card[variant];
};

// Animation keyframes for blog components
export const blogAnimations = {
  fadeIn: {
    '@keyframes fadeIn': {
      from: { opacity: 0, transform: 'translateY(20px)' },
      to: { opacity: 1, transform: 'translateY(0)' }
    },
    animation: 'fadeIn 0.3s ease-out'
  },
  
  slideIn: {
    '@keyframes slideIn': {
      from: { opacity: 0, transform: 'translateX(-20px)' },
      to: { opacity: 1, transform: 'translateX(0)' }
    },
    animation: 'slideIn 0.3s ease-out'
  },

  pulse: {
    '@keyframes pulse': {
      '0%': { opacity: 1 },
      '50%': { opacity: 0.5 },
      '100%': { opacity: 1 }
    },
    animation: 'pulse 2s ease-in-out infinite'
  },

  shimmer: {
    '@keyframes shimmer': {
      '0%': { backgroundPosition: '-200px 0' },
      '100%': { backgroundPosition: 'calc(200px + 100%) 0' }
    },
    background: 'linear-gradient(90deg, #f0f0f0 0px, #e0e0e0 40px, #f0f0f0 80px)',
    backgroundSize: '200px 100%',
    animation: 'shimmer 1.5s ease-in-out infinite'
  }
};

// Responsive breakpoints for blog components
export const blogBreakpoints = {
  mobile: '@media (max-width: 600px)',
  tablet: '@media (max-width: 960px)',
  desktop: '@media (min-width: 961px)'
};

// Blog component spacing
export const blogSpacing = {
  xs: 0.5,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4
};

// Blog typography variants
export const blogTypography = {
  cardTitle: {
    fontWeight: 600,
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  cardSummary: {
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  postContent: {
    lineHeight: 1.7,
    fontSize: '1rem'
  },
  caption: {
    fontSize: '0.75rem',
    color: 'text.secondary'
  }
};

// Export default blog theme
export default blogTheme;
