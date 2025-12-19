import React from 'react';
import {
  Box,
  Typography,
  Container,
  Toolbar
} from '@mui/material';
import AnimatedBackground from '../components/common/AnimatedBackground';

interface CommunityPageProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
}

const CommunityPage: React.FC<CommunityPageProps> = ({ onToggleTheme, mode }) => {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', position: 'relative', overflow: 'hidden' }}>
      <AnimatedBackground />

      <Container maxWidth="lg" sx={{ flex: 1, py: 4, position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography variant="h4" gutterBottom>
            Community
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Coming Soon
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default CommunityPage;

