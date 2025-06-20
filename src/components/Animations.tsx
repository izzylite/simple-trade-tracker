import { keyframes } from '@mui/system';
import { styled } from '@mui/material/styles';
import { Box, Paper } from '@mui/material';

// Fade in animation
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

// Slide up animation
export const slideUp = keyframes`
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

// Slide down animation
export const slideDown = keyframes`
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

// Slide left animation
export const slideLeft = keyframes`
  from {
    transform: translateX(20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

// Slide right animation
export const slideRight = keyframes`
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

// Scale up animation
export const scaleUp = keyframes`
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

// Pulse animation
export const pulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
`;

// Shake animation
export const shake = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-5px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(5px);
  }
`;

// Bounce animation
export const bounce = keyframes`
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
`;

// Rotate animation
export const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Animated container component
export const AnimatedContainer = styled(Box)(({ theme }) => ({
  animation: `${fadeIn} 0.5s ease-out`,
}));

// Animated paper component
export const AnimatedPaper = styled(Paper)(({ theme }) => ({
  animation: `${scaleUp} 0.3s ease-out`,
}));

// Animated slide up component
export const AnimatedSlideUp = styled(Box)({
  animation: 'slideUp 0.3s ease-out',
  '@keyframes slideUp': {
    from: {
      opacity: 0,
      transform: 'translateY(20px)'
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)'
    }
  }
});

// Animated slide down component
export const AnimatedSlideDown = styled(Box)({
  animation: 'slideDown 0.3s ease-out',
  '@keyframes slideDown': {
    from: {
      opacity: 0,
      transform: 'translateY(-20px)'
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)'
    }
  }
});

// Animated slide left component
export const AnimatedSlideLeft = styled(Box)(({ theme }) => ({
  animation: `${slideLeft} 0.5s ease-out`,
}));

// Animated slide right component
export const AnimatedSlideRight = styled(Box)(({ theme }) => ({
  animation: `${slideRight} 0.5s ease-out`,
}));

// Animated pulse component
export const AnimatedPulse = styled(Box)({
  animation: 'pulse 2s infinite',
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(1)'
    },
    '50%': {
      transform: 'scale(1.05)'
    },
    '100%': {
      transform: 'scale(1)'
    }
  }
});

// Animated shake component
export const AnimatedShake = styled(Box)(({ theme }) => ({
  animation: `${shake} 0.5s ease-in-out`,
}));

// Animated bounce component
export const AnimatedBounce = styled(Box)(({ theme }) => ({
  animation: `${bounce} 2s infinite`,
}));

// Animated dropdown component
export const AnimatedDropdown = styled(Box)({
  animation: 'dropdown 0.3s ease-out',
  transformOrigin: 'top',
  overflow: 'hidden',
  '@keyframes dropdown': {
    from: {
      opacity: 0,
      maxHeight: '0px',
      transform: 'scaleY(0)'
    },
    to: {
      opacity: 1,
      maxHeight: '1000px',
      transform: 'scaleY(1)'
    }
  }
});

// Animated rotate component
export const AnimatedRotate = styled(Box)(({ theme }) => ({
  animation: `${rotate} 2s linear infinite`,
}));

// Staggered animation container
export const StaggeredContainer = styled(Box)(({ theme }) => ({
  '& > *': {
    opacity: 0,
    animation: `${fadeIn} 0.5s ease-out forwards`,
  },
  '& > *:nth-of-type(1)': {
    animationDelay: '0.1s',
  },
  '& > *:nth-of-type(2)': {
    animationDelay: '0.2s',
  },
  '& > *:nth-of-type(3)': {
    animationDelay: '0.3s',
  },
  '& > *:nth-of-type(4)': {
    animationDelay: '0.4s',
  },
  '& > *:nth-of-type(5)': {
    animationDelay: '0.5s',
  },
  '& > *:nth-of-type(6)': {
    animationDelay: '0.6s',
  },
  '& > *:nth-of-type(7)': {
    animationDelay: '0.7s',
  },
}));

// Staggered slide up container
export const StaggeredSlideUp = styled(Box)(({ theme }) => ({
  '& > *': {
    opacity: 0,
    animation: `${slideUp} 0.5s ease-out forwards`,
  },
  '& > *:nth-of-type(1)': {
    animationDelay: '0.1s',
  },
  '& > *:nth-of-type(2)': {
    animationDelay: '0.2s',
  },
  '& > *:nth-of-type(3)': {
    animationDelay: '0.3s',
  },
  '& > *:nth-of-type(4)': {
    animationDelay: '0.4s',
  },
  '& > *:nth-of-type(5)': {
    animationDelay: '0.5s',
  },
  '& > *:nth-of-type(6)': {
    animationDelay: '0.6s',
  },
  '& > *:nth-of-type(7)': {
    animationDelay: '0.7s',
  },
}));

// Staggered slide down container
export const StaggeredSlideDown = styled(Box)(({ theme }) => ({
  '& > *': {
    opacity: 0,
    animation: `${slideDown} 0.5s ease-out forwards`,
  },
  '& > *:nth-of-type(1)': {
    animationDelay: '0.1s',
  },
  '& > *:nth-of-type(2)': {
    animationDelay: '0.2s',
  },
  '& > *:nth-of-type(3)': {
    animationDelay: '0.3s',
  },
  '& > *:nth-of-type(4)': {
    animationDelay: '0.4s',
  },
  '& > *:nth-of-type(5)': {
    animationDelay: '0.5s',
  },
  '& > *:nth-of-type(6)': {
    animationDelay: '0.6s',
  },
  '& > *:nth-of-type(7)': {
    animationDelay: '0.7s',
  },
}));

// Staggered scale up container
export const StaggeredScaleUp = styled(Box)(({ theme }) => ({
  '& > *': {
    opacity: 0,
    animation: `${scaleUp} 0.5s ease-out forwards`,
  },
  '& > *:nth-of-type(1)': {
    animationDelay: '0.1s',
  },
  '& > *:nth-of-type(2)': {
    animationDelay: '0.2s',
  },
  '& > *:nth-of-type(3)': {
    animationDelay: '0.3s',
  },
  '& > *:nth-of-type(4)': {
    animationDelay: '0.4s',
  },
  '& > *:nth-of-type(5)': {
    animationDelay: '0.5s',
  },
  '& > *:nth-of-type(6)': {
    animationDelay: '0.6s',
  },
  '& > *:nth-of-type(7)': {
    animationDelay: '0.7s',
  },
}));