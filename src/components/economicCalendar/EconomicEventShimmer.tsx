import React from 'react';
import { Box } from '@mui/material';
import Shimmer from '../Shimmer';

interface EconomicEventShimmerProps {
  count?: number;
}

/**
 * Reusable shimmer loading component for economic events
 * Matches the structure of EconomicEventListItem
 */
const EconomicEventShimmer: React.FC<EconomicEventShimmerProps> = ({ count = 8 }) => {
  return (
    <Box sx={{ p: 3 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index} sx={{ mb: 3 }}>
          {/* Event header row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Shimmer
              width={40}
              height={20}
              borderRadius={4}
              variant="default"
              intensity="medium"
              sx={{ animationDelay: `${index * 0.1}s` }}
            />
            <Shimmer
              width={60}
              height={20}
              borderRadius={4}
              variant="default"
              intensity="medium"
              sx={{ animationDelay: `${index * 0.1 + 0.1}s` }}
            />
            <Shimmer
              width={50}
              height={16}
              borderRadius={4}
              variant="default"
              intensity="low"
              sx={{ animationDelay: `${index * 0.1 + 0.2}s` }}
            />
          </Box>
          
          {/* Event title */}
          <Shimmer
            width="80%"
            height={18}
            borderRadius={4}
            variant="wave"
            intensity="medium"
            sx={{ 
              mb: 0.5,
              animationDelay: `${index * 0.1 + 0.3}s`
            }}
          />
          
          {/* Event details */}
          <Shimmer
            width="60%"
            height={14}
            borderRadius={4}
            variant="default"
            intensity="low"
            sx={{ animationDelay: `${index * 0.1 + 0.4}s` }}
          />
        </Box>
      ))}
    </Box>
  );
};

export default EconomicEventShimmer;

