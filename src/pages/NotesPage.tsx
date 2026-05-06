import React from 'react';
import { Box } from '@mui/material';
import NotesContent from '../components/sidePanel/content/NotesContent';

const APP_HEADER_HEIGHT = 64;

/**
 * Cross-calendar notes aggregation. Reuses NotesContent with
 * showCalendarPicker so the user can filter by calendar (or view all).
 * Behaviour mirrors HomePage's existing implementation but as a full
 * page rather than a side-panel view.
 */
const NotesPage: React.FC = () => {
  return (
    <Box
      sx={{
        height: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <NotesContent showCalendarPicker isActive />
    </Box>
  );
};

export default NotesPage;
