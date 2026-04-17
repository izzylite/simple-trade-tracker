import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  alpha,
  useTheme,
} from '@mui/material';
import {
  HelpOutline as HelpOutlineIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarToday as CalendarTodayIcon,
  TrendingUp as TrendingUpIcon,
  Event as EventIcon,
  StickyNote2 as StickyNote2Icon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';

import { scrollbarStyles } from '../../styles/scrollbarStyles';
import { FAQS, FAQ_CATEGORIES, FAQCategoryId, FAQItem } from './faqData';

type CategoryFilter = FAQCategoryId | 'all';

const CATEGORY_ICONS: Record<FAQCategoryId, React.ReactElement> = {
  calendars: <CalendarTodayIcon sx={{ fontSize: 16 }} />,
  trades: <TrendingUpIcon sx={{ fontSize: 16 }} />,
  'economic-events': <EventIcon sx={{ fontSize: 16 }} />,
  notes: <StickyNote2Icon sx={{ fontSize: 16 }} />,
  orion: <AutoAwesomeIcon sx={{ fontSize: 16 }} />,
};

const FAQContent: React.FC = () => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [expandedId, setExpandedId] = useState<string | false>(false);

  const filtered = useMemo<FAQItem[]>(() => {
    const query = search.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (activeCategory !== 'all' && f.category !== activeCategory) return false;
      if (!query) return true;
      return (
        f.question.toLowerCase().includes(query) ||
        f.answer.toLowerCase().includes(query)
      );
    });
  }, [search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<FAQCategoryId, FAQItem[]>();
    FAQ_CATEGORIES.forEach((c) => map.set(c.id, []));
    filtered.forEach((f) => map.get(f.category)?.push(f));
    return map;
  }, [filtered]);

  const totalShown = filtered.length;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Sticky top: search + category filters */}
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          pt: 2,
          pb: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1.5 }}
        />
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.75,
          }}
        >
          <Chip
            label="All"
            size="small"
            clickable
            onClick={() => setActiveCategory('all')}
            color={activeCategory === 'all' ? 'primary' : 'default'}
            variant={activeCategory === 'all' ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600, flexShrink: 0 }}
          />
          {FAQ_CATEGORIES.map((c) => {
            const isActive = activeCategory === c.id;
            return (
              <Chip
                key={c.id}
                icon={CATEGORY_ICONS[c.id]}
                label={c.label}
                size="small"
                clickable
                onClick={() => setActiveCategory(c.id)}
                color={isActive ? 'primary' : 'default'}
                variant={isActive ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600, flexShrink: 0 }}
              />
            );
          })}
        </Box>
      </Box>

      {/* Scrollable list */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 1.5, sm: 2 },
          py: 1.5,
          minHeight: 0,
          ...scrollbarStyles(theme),
        }}
      >
        {totalShown === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              px: 2,
              color: 'text.secondary',
            }}
          >
            <HelpOutlineIcon sx={{ fontSize: 42, mb: 1.5, opacity: 0.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              No matching questions
            </Typography>
            <Typography variant="body2">
              Try a different search term or category.
            </Typography>
          </Box>
        ) : (
          FAQ_CATEGORIES.map((category) => {
            const items = grouped.get(category.id) ?? [];
            if (items.length === 0) return null;
            return (
              <Box key={category.id} sx={{ mb: 2.5 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ px: 1, mb: 1 }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                    }}
                  >
                    {CATEGORY_ICONS[category.id]}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {category.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {category.description}
                    </Typography>
                  </Box>
                </Stack>

                <Stack spacing={0.75}>
                  {items.map((item) => {
                    const isExpanded = expandedId === item.id;
                    return (
                      <Accordion
                        key={item.id}
                        expanded={isExpanded}
                        onChange={(_, next) =>
                          setExpandedId(next ? item.id : false)
                        }
                        disableGutters
                        elevation={0}
                        square={false}
                        sx={{
                          borderRadius: 2,
                          border: `1px solid ${theme.palette.divider}`,
                          bgcolor: 'background.default',
                          '&:before': { display: 'none' },
                          '&.Mui-expanded': {
                            borderColor: alpha(theme.palette.primary.main, 0.4),
                          },
                          '&:hover': {
                            transform: 'none',
                          },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{
                            px: 1.75,
                            minHeight: 44,
                            '& .MuiAccordionSummary-content': {
                              my: 1,
                            },
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.875rem',
                            }}
                          >
                            {item.question}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails
                          sx={{
                            px: 1.75,
                            pt: 0,
                            pb: 1.75,
                          }}
                        >
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              fontSize: '0.8125rem',
                              lineHeight: 1.6,
                            }}
                          >
                            {item.answer}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })}
                </Stack>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default FAQContent;
