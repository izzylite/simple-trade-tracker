import React from 'react';
import { Box } from '@mui/material';
import { RULE } from './landingTokens';
import CalendarShowcase from './sections/CalendarShowcase';
import PerformanceSection from './sections/PerformanceSection';
import EventsSection from './sections/EventsSection';
import NotesSection from './sections/NotesSection';
import OrionContextSection from './sections/OrionContextSection';
import BriefingsRemindersSection from './sections/BriefingsRemindersSection';

const LandingBento: React.FC = () => (
    <Box sx={{ bgcolor: '#080808', borderBottom: RULE }}>
        <CalendarShowcase />
        <PerformanceSection />
        <EventsSection />
        <NotesSection />
        <OrionContextSection />
        <BriefingsRemindersSection />
    </Box>
);

export default LandingBento;
