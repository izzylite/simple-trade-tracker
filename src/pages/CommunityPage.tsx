import React from 'react';
import {
  Box,
  Typography,
  Container,
  Toolbar
} from '@mui/material';

interface CommunityPageProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
  onMenuClick: () => void;
}

const CommunityPage: React.FC<CommunityPageProps> = ({ onToggleTheme, mode, onMenuClick }) => {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>


      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
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

