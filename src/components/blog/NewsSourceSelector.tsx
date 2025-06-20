import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  SelectChangeEvent,
  OutlinedInput
} from '@mui/material';
import { Clear } from '@mui/icons-material';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface NewsSource {
  id: string;
  name: string;
  description?: string;
}

interface NewsSourceSelectorProps {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
  multiple?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
}

// Available NewsAPI sources for financial/business news
const AVAILABLE_SOURCES: NewsSource[] = [
  { id: 'bloomberg', name: 'Bloomberg', description: 'Financial and business news' },
  { id: 'reuters', name: 'Reuters', description: 'International news and business' },
  { id: 'cnbc', name: 'CNBC', description: 'Business and financial news' },
  { id: 'wall-street-journal', name: 'Wall Street Journal', description: 'Business and financial news' },
  { id: 'financial-times', name: 'Financial Times', description: 'Global business news' },
  { id: 'yahoo-finance', name: 'Yahoo Finance', description: 'Financial news and data' },
  { id: 'marketwatch', name: 'MarketWatch', description: 'Financial market news' },
  { id: 'business-insider', name: 'Business Insider', description: 'Business and technology news' },
  { id: 'fortune', name: 'Fortune', description: 'Business magazine' },
  { id: 'forbes', name: 'Forbes', description: 'Business and finance magazine' },
  { id: 'cnn-business', name: 'CNN Business', description: 'Business news from CNN' },
  { id: 'bbc-business', name: 'BBC Business', description: 'Business news from BBC' },
  { id: 'associated-press', name: 'Associated Press', description: 'News wire service' },
  { id: 'axios', name: 'Axios', description: 'News and information' },
  { id: 'techcrunch', name: 'TechCrunch', description: 'Technology and startup news' },
  { id: 'the-verge', name: 'The Verge', description: 'Technology news' },
  { id: 'ars-technica', name: 'Ars Technica', description: 'Technology news and analysis' },
  { id: 'engadget', name: 'Engadget', description: 'Technology news' },
  { id: 'wired', name: 'Wired', description: 'Technology and culture magazine' }
];

const NewsSourceSelector: React.FC<NewsSourceSelectorProps> = ({
  selectedSources,
  onSourcesChange,
  multiple = true,
  size = 'small',
  fullWidth = true
}) => {
  const handleChange = (event: SelectChangeEvent<string | string[]>) => {
    const value = event.target.value;
    
    if (multiple) {
      // Handle multiple selection
      const sources = typeof value === 'string' ? value.split(',') : value as string[];
      onSourcesChange(sources);
    } else {
      // Handle single selection
      const source = typeof value === 'string' ? value : (value as string[])[0] || '';
      onSourcesChange([source]);
    }
  };

  const handleChipDelete = (sourceIdToRemove: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the select from opening
    const newSources = selectedSources.filter(id => id !== sourceIdToRemove);
    onSourcesChange(newSources);
  };

  const renderValue = (selected: string | string[]) => {
    const sources = Array.isArray(selected) ? selected : [selected];

    if (!multiple) {
      const source = AVAILABLE_SOURCES.find(s => s.id === sources[0]);
      return source ? source.name : '';
    }

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {sources.map((sourceId) => {
          const source = AVAILABLE_SOURCES.find(s => s.id === sourceId);
          return (
            <Chip
              key={sourceId}
              label={source?.name || sourceId}
              size="small"
              onDelete={(event) => handleChipDelete(sourceId, event)}
              deleteIcon={<Clear sx={{ fontSize: '14px !important' }} />}
              sx={{
                height: 20,
                fontSize: '0.75rem',
                '& .MuiChip-deleteIcon': {
                  fontSize: '14px',
                  width: '14px',
                  height: '14px'
                }
              }}
            />
          );
        })}
      </Box>
    );
  };

  return (
    <FormControl size={size} fullWidth={fullWidth}>
      <InputLabel id="news-source-selector-label">
        {multiple ? 'News Sources' : 'News Source'}
      </InputLabel>
      <Select
        labelId="news-source-selector-label"
        multiple={multiple}
        value={multiple ? selectedSources : (selectedSources[0] || '')}
        onChange={handleChange}
        input={<OutlinedInput label={multiple ? 'News Sources' : 'News Source'} />}
        renderValue={renderValue}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 300,
              width: 300,
            },
            sx: (theme) => ({
              ...scrollbarStyles(theme),
              '& .MuiList-root': {
                ...scrollbarStyles(theme)
              }
            })
          },
        }}
      >
        {AVAILABLE_SOURCES.map((source) => (
          <MenuItem key={source.id} value={source.id}>
            <Box>
              <Box component="span" sx={{ fontWeight: 'medium' }}>
                {source.name}
              </Box>
              {source.description && (
                <Box 
                  component="span" 
                  sx={{ 
                    display: 'block', 
                    fontSize: '0.75rem', 
                    color: 'text.secondary',
                    mt: 0.25
                  }}
                >
                  {source.description}
                </Box>
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default NewsSourceSelector;
export { AVAILABLE_SOURCES };
export type { NewsSource };
