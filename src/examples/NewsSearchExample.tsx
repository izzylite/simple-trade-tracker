import React, { useState } from 'react';
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { BlogFilters, NewsApiResponse } from '../types/blog';
import { newsService } from '../services/blog/newsService';
import NewsSourceSelector from '../components/blog/NewsSourceSelector';

/**
 * Example component showing how to search with specific NewsAPI sources
 */
const NewsSearchExample: React.FC = () => {
  const [filters, setFilters] = useState<BlogFilters>({});
  const [searchResults, setSearchResults] = useState<NewsApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!filters.sources || filters.sources.length === 0) {
      setError('Please select at least one news source');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Searching with filters:', filters);
      
      // This will trigger enhanced search because sources are specified
      const results = await newsService.fetchAllNews(filters, 1, 20);
      
      setSearchResults(results);
      console.log('Search results:', results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSourcesChange = (sources: string[]) => {
    setFilters(prev => ({
      ...prev,
      sources: sources.length > 0 ? sources : undefined
    }));
  };

  const handleQueryChange = (query: string) => {
    setFilters(prev => ({
      ...prev,
      searchQuery: query.trim() || undefined
    }));
  };

  // Example preset searches
  const presetSearches = [
    {
      name: 'Financial News from Bloomberg & Reuters',
      sources: ['bloomberg', 'reuters'],
      query: 'market'
    },
    {
      name: 'Tech News from TechCrunch & The Verge',
      sources: ['techcrunch', 'the-verge'],
      query: 'technology'
    },
    {
      name: 'Business News from WSJ & Forbes',
      sources: ['wall-street-journal', 'forbes'],
      query: 'business'
    }
  ];

  const applyPreset = (preset: typeof presetSearches[0]) => {
    setFilters({
      sources: preset.sources,
      searchQuery: preset.query
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        NewsAPI Enhanced Search Example
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        This example shows how to search for news articles from specific NewsAPI sources.
        When you select sources and perform a search, it will use the enhanced search API
        that queries NewsAPI directly with your specified sources.
      </Typography>

      {/* Preset Searches */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Presets
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {presetSearches.map((preset, index) => (
            <Button
              key={index}
              variant="outlined"
              size="small"
              onClick={() => applyPreset(preset)}
              sx={{ textTransform: 'none' }}
            >
              {preset.name}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Source Selection */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Select News Sources
          </Typography>
          {filters.sources && filters.sources.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              color="error"
              onClick={() => handleSourcesChange([])}
              sx={{ textTransform: 'none' }}
            >
              Clear All Sources
            </Button>
          )}
        </Box>
        <NewsSourceSelector
          selectedSources={filters.sources || []}
          onSourcesChange={handleSourcesChange}
          multiple={true}
          size="medium"
          fullWidth={true}
        />
        {filters.sources && filters.sources.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {filters.sources.length} source{filters.sources.length !== 1 ? 's' : ''} selected.
            Click the × on individual chips to remove specific sources.
          </Typography>
        )}
      </Box>

      {/* Search Query */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Query (Optional)
        </Typography>
        <input
          type="text"
          placeholder="Enter search terms..."
          value={filters.searchQuery || ''}
          onChange={(e) => handleQueryChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            fontSize: '16px'
          }}
        />
      </Box>

      {/* Search Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleSearch}
          disabled={isLoading || !filters.sources?.length}
          startIcon={isLoading ? <CircularProgress size={20} /> : null}
          sx={{ mr: 2 }}
        >
          {isLoading ? 'Searching...' : 'Search News'}
        </Button>
        
        <Button
          variant="outlined"
          onClick={() => {
            setFilters({});
            setSearchResults(null);
            setError(null);
          }}
        >
          Clear
        </Button>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Results Display */}
      {searchResults && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Search Results ({searchResults.totalResults} articles)
          </Typography>
          
          {searchResults.articles.length === 0 ? (
            <Alert severity="info">
              No articles found. Try different sources or search terms.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {searchResults.articles.slice(0, 5).map((article, index) => (
                <Box
                  key={article.id}
                  sx={{
                    p: 2,
                    border: '1px solid #e0e0e0',
                    borderRadius: 2,
                    backgroundColor: '#f9f9f9'
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    {article.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {article.source.name} • {new Date(article.publishedAt).toLocaleDateString()}
                  </Typography>
                  <Typography variant="body2">
                    {article.summary}
                  </Typography>
                  {article.url && (
                    <Button
                      size="small"
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ mt: 1 }}
                    >
                      Read More
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Debug Info */}
      <Box sx={{ mt: 4, p: 2, backgroundColor: '#f5f5f5', borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Debug Info
        </Typography>
        <Typography variant="body2" component="pre" sx={{ fontSize: '12px' }}>
          {JSON.stringify({ filters, searchResults: searchResults ? {
            status: searchResults.status,
            totalResults: searchResults.totalResults,
            articlesCount: searchResults.articles.length,
            fromCache: (searchResults as any).fromCache
          } : null }, null, 2)}
        </Typography>
      </Box>
    </Box>
  );
};

export default NewsSearchExample;
