import React, { useState, useEffect } from 'react';
import { 
  Box, 
  LinearProgress, 
  Typography, 
  useTheme, 
  alpha, 
  Paper,
  keyframes
} from '@mui/material';
import { CalendarToday } from '@mui/icons-material';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const AppLoadingProgress: React.FC = () => {
  const theme = useTheme();
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing application');
  
  // Simulate progress
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        // Slow down progress as it approaches 100%
        if (oldProgress >= 90) {
          return Math.min(oldProgress + 0.5, 95);
        }
        return Math.min(oldProgress + (Math.random() * 5), 90);
      });
    }, 200);

    return () => {
      clearInterval(timer);
    };
  }, []);
  
  // Change loading text based on progress
  useEffect(() => {
    if (progress < 30) {
      setLoadingText('Initializing application');
    } else if (progress < 60) {
      setLoadingText('Loading components');
    } else if (progress < 85) {
      setLoadingText('Preparing interface');
    } else {
      setLoadingText('Almost ready');
    }
  }, [progress]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        background: theme.palette.background.default,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 4,
          borderRadius: 2,
          width: { xs: '85%', sm: '450px' },
          maxWidth: '450px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)',
          animation: `${fadeIn} 0.5s ease-out`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
            position: 'relative',
          }}
        >
          <Box
            sx={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: alpha(theme.palette.primary.main, 0.1),
              boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <CalendarToday
              sx={{
                fontSize: '2rem',
                color: theme.palette.primary.main,
              }}
            />
          </Box>
        </Box>

        <Typography
          variant="h6"
          sx={{
            mb: 1,
            fontWeight: 600,
            textAlign: 'center',
            color: theme.palette.text.primary,
          }}
        >
          Trade Tracker
        </Typography>

        <Typography
          variant="body2"
          sx={{
            mb: 3,
            color: theme.palette.text.secondary,
            textAlign: 'center',
          }}
        >
          {loadingText}
        </Typography>

        <Box sx={{ width: '100%', mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundImage: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
              },
            }}
          />
        </Box>

        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            alignSelf: 'flex-end',
            mt: 0.5,
          }}
        >
          {`${Math.round(progress)}%`}
        </Typography>
      </Paper>
    </Box>
  );
};

export default AppLoadingProgress;
