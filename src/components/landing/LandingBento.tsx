import React from 'react';
import { Box } from '@mui/material';
import { RULE } from 'components/landing/landingTokens';
import CalendarShowcase from 'components/landing/sections/CalendarShowcase';
import ImportSection from 'components/landing/sections/ImportSection';
import PerformanceSection from 'components/landing/sections/PerformanceSection';
import EventsSection from 'components/landing/sections/EventsSection';
import NotesSection from 'components/landing/sections/NotesSection';
import OrionContextSection from 'components/landing/sections/OrionContextSection';
import BriefingsRemindersSection from 'components/landing/sections/BriefingsRemindersSection';

const LandingBento: React.FC = () => (
    <Box sx={{ bgcolor: '#080808', borderBottom: RULE }}>
        <ImportSection />
        <CalendarShowcase />
        <EventsSection />
         <NotesSection />
        <OrionContextSection />
        <BriefingsRemindersSection /> 
        <PerformanceSection /> 
    </Box>
);

export default LandingBento;
