/**
 * Vector Search Results Component
 * Shows the trades found by vector search for transparency
 */

import React, { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Typography,
  Paper,
  Stack,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { TradeSearchResult } from '../../services/vectorSearchService';

interface VectorSearchResultsProps {
  results: TradeSearchResult[];
  query?: string;
}

export const VectorSearchResults: React.FC<VectorSearchResultsProps> = ({
  results,
  query
}) => {
  const [expanded, setExpanded] = useState(false);

  if (results.length === 0) {
    return null;
  }

  const getTradeTypeIcon = (type: string) => {
    switch (type) {
      case 'win':
        return <TrendingUpIcon sx={{ fontSize: '0.8rem', color: 'success.main' }} />;
      case 'loss':
        return <TrendingDownIcon sx={{ fontSize: '0.8rem', color: 'error.main' }} />;
      case 'breakeven':
        return <RemoveIcon sx={{ fontSize: '0.8rem', color: 'warning.main' }} />;
      default:
        return undefined;
    }
  };

  const getTradeTypeColor = (type: string) => {
    switch (type) {
      case 'win':
        return 'success';
      case 'loss':
        return 'error';
      case 'breakeven':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Paper 
      sx={{ 
        p: 2, 
        mb: 2, 
        backgroundColor: 'primary.50',
        border: '1px solid',
        borderColor: 'primary.200'
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
          <Typography variant="body2" color="primary.main" fontWeight="medium">
            Vector Search Results
          </Typography>
          <Chip 
            label={`${results.length} relevant trades`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        </Box>
        
        <IconButton size="small" sx={{ color: 'primary.main' }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {query && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Query: "{query}"
        </Typography>
      )}

      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            These trades were selected as most relevant to your question:
          </Typography>
          
          <Stack spacing={1} sx={{ mt: 1 }}>
            {results.slice(0, 10).map((result, index) => (
              <Box
                key={result.tradeId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  backgroundColor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20 }}>
                  {index + 1}.
                </Typography>
                
                <Chip
                  icon={getTradeTypeIcon(result.tradeType)}
                  label={result.tradeType.toUpperCase()}
                  size="small"
                  color={getTradeTypeColor(result.tradeType) as any}
                  variant="outlined"
                  sx={{ fontSize: '0.65rem', minWidth: 60 }}
                />
                
                <Typography variant="caption" sx={{ minWidth: 80 }}>
                  ${Math.abs(result.tradeAmount).toFixed(0)}
                </Typography>
                
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
                  {new Date(result.tradeDate).toLocaleDateString()}
                </Typography>
                
                {result.tradeSession && (
                  <Chip
                    label={result.tradeSession}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.6rem' }}
                  />
                )}
                
                {result.tags.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {result.tags.slice(0, 2).map((tag, tagIndex) => (
                      <Chip
                        key={tagIndex}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.6rem' }}
                      />
                    ))}
                    {result.tags.length > 2 && (
                      <Typography variant="caption" color="text.secondary">
                        +{result.tags.length - 2}
                      </Typography>
                    )}
                  </Box>
                )}
                
                <Box sx={{ ml: 'auto' }}>
                  <Tooltip title="Similarity Score">
                    <Chip
                      label={`${(result.similarity * 100).toFixed(0)}%`}
                      size="small"
                      color="primary"
                      sx={{ fontSize: '0.65rem' }}
                    />
                  </Tooltip>
                </Box>
              </Box>
            ))}
            
            {results.length > 10 && (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                ... and {results.length - 10} more trades
              </Typography>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
};
