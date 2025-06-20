import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Alert,
  Snackbar,
  Pagination,
  Button
} from '@mui/material';

import { BlogPost as BlogPostType, BlogFilters as BlogFiltersType, NewsSource, BlogState } from '../../types/blog';
import { newsService } from '../../services/blog/newsService';
import { sourcesService } from '../../services/blog/sourcesService';
import BlogCard from './BlogCard';
import BlogFilters from './BlogFilters';
import BlogPostComponent from './BlogPost';
import BlogErrorBoundary from './BlogErrorBoundary';
import { BlogGridSkeleton, BlogEmptyState } from './BlogLoadingStates';
import AppHeader from '../common/AppHeader';

interface BlogHomeProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
}

const BlogHome: React.FC<BlogHomeProps> = ({ onToggleTheme, mode }) => {
  const [blogState, setBlogState] = useState<BlogState>({
    posts: [],
    sources: [],
    filters: {
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    },
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      hasNext: false,
      hasPrev: false
    },
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  const [selectedPost, setSelectedPost] = useState<BlogPostType | null>(null);
  const [availableSources, setAvailableSources] = useState<NewsSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });
  // Load sources from Firebase
  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    try {
      const response = await sourcesService.fetchSources();
      if (response.status === 'success') {
        setAvailableSources(response.sources);
      } else {
        console.warn('Failed to load sources:', response.error);

        // If no sources found, try to initialize them
        if (response.error?.includes('No sources configuration found')) {
          const initResponse = await sourcesService.initializeSources();
          if (initResponse.status === 'success') {
            setAvailableSources(initResponse.sources);
          } else {
            setAvailableSources([]);
          }
        } else {
          setAvailableSources([]);
        }
      }
    } catch (error) {
      setAvailableSources([]);
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  // Load news and sources on component mount
  useEffect(() => {
    loadNews();
    loadSources();
  }, []);

  const loadNews = useCallback(async (silent = false, customFilters?: BlogFiltersType, page?: number) => {
    if (!silent) {
      setBlogState(prev => ({ ...prev, isLoading: true, error: null }));
    }

    try {
      // Use custom filters if provided, otherwise use current state filters
      const filtersToUse = customFilters || blogState.filters;
      const currentPage = page || blogState.pagination.page;
      const pageSize = blogState.pagination.limit;

      // Fetch news with pagination
      const response = await newsService.fetchAllNews(filtersToUse, currentPage, pageSize);

      if (response.status === 'success') {
        setBlogState(prev => ({
          ...prev,
          posts: response.articles,
          lastUpdated: new Date(),
          isLoading: false,
          error: response.error || null, // Show warning if using fallback data
          pagination: {
            page: currentPage,
            limit: pageSize,
            total: response.totalResults,
            hasNext: response.pagination?.hasNext || false,
            hasPrev: response.pagination?.hasPrev || false
          }
        }));

        if (silent && response.articles.length > 0) {
          showSnackbar('News updated successfully', 'success');
        } else if (page && response.articles.length > 0) {
          showSnackbar(`Loaded page ${currentPage}`, 'success');
        }
      } else {
        throw new Error(response.error || 'Failed to fetch news');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load news';
      setBlogState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));

      if (!silent) {
        showSnackbar(errorMessage, 'error');
      }
    }
  }, [blogState.filters, blogState.pagination.page, blogState.pagination.limit]);

  const handleFiltersChange = (newFilters: BlogFiltersType) => {
    setBlogState(prev => ({
      ...prev,
      filters: newFilters,
      pagination: {
        ...prev.pagination,
        page: 1 // Reset to first page when filters change
      }
    }));

    // Reload news immediately with new filters from page 1
    loadNews(false, newFilters, 1);
  };

  const handleClearFilters = () => {
    const defaultFilters: BlogFiltersType = {
      sortBy: 'publishedAt',
      sortOrder: 'desc'
    };
    handleFiltersChange(defaultFilters);
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    console.log(`Changing to page ${page}`);
    setBlogState(prev => ({
      ...prev,
      pagination: {
        ...prev.pagination,
        page
      }
    }));
    loadNews(false, undefined, page);
  };

  const handlePostClick = (post: BlogPostType) => {
    setSelectedPost(post);
  };



  const handleShare = async (post: BlogPostType) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.summary,
          url: post.url
        });
      } else {
        await navigator.clipboard.writeText(post.url);
        showSnackbar('Link copied to clipboard', 'success');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      showSnackbar('Failed to share article', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleInitializeSources = async () => {
    setSourcesLoading(true);
    try {
      const response = await sourcesService.initializeSources();
      if (response.status === 'success') {
        setAvailableSources(response.sources);
        showSnackbar(`Initialized ${response.sources.length} sources successfully`, 'success');
      } else {
        showSnackbar(`Failed to initialize sources: ${response.error}`, 'error');
      }
    } catch (error) {
      showSnackbar('Error initializing sources', 'error');
    } finally {
      setSourcesLoading(false);
    }
  };

  const getAvailableTags = (): string[] => {
    const allTags = blogState.posts.flatMap(post => post.tags);
    return Array.from(new Set(allTags)).sort();
  };



  return (
    <BlogErrorBoundary>
      <Box sx={{ minHeight: '100vh', bgcolor: 'custom.pageBackground' }}>
        <AppHeader
          title="Trade News"
          onToggleTheme={onToggleTheme}
          mode={mode}
        />

      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Box
          sx={{
            mb: 4,
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(25, 118, 210, 0.05) 0%, rgba(25, 118, 210, 0.02) 100%)',
            borderRadius: 3,
            p: 4,
            border: (theme) => `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}`,
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 8px 32px rgba(0, 0, 0, 0.3)'
              : '0 8px 32px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 700,
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(45deg, #ffffff 30%, #e3f2fd 90%)'
                : 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 2
            }}
          >
            Latest Trade News
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ mb: 3, fontWeight: 400 }}
          >
            Stay updated with the latest market insights and trading strategies
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {blogState.lastUpdated && `Last updated: ${blogState.lastUpdated.toLocaleTimeString()}`}
            </Typography>
            {blogState.posts.length > 0 && (
              <Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
                {blogState.posts.length} articles available
              </Typography>
            )}
            {availableSources.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="warning.main" sx={{ fontWeight: 500 }}>
                  No sources available
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleInitializeSources}
                  disabled={sourcesLoading}
                >
                  {sourcesLoading ? 'Initializing...' : 'Initialize Sources'}
                </Button>
              </Box>
            )}
          </Box>
        </Box>

        {/* Filters */}
        <BlogFilters
          filters={blogState.filters}
          sources={availableSources}
          availableTags={getAvailableTags()}
          onFiltersChange={handleFiltersChange}
          onClearFilters={handleClearFilters}
          isLoading={blogState.isLoading || sourcesLoading}
        />

        {/* Error Alert */}
        {blogState.error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setBlogState(prev => ({ ...prev, error: null }))}>
            {blogState.error}
          </Alert>
        )}

        {/* Posts Grid */}
        {blogState.isLoading ? (
          <BlogGridSkeleton count={8} />
        ) : blogState.posts.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)'
              },
              gap: { xs: 2, md: 3 }
            }}
          >
            {blogState.posts.map((post) => (
              <BlogCard
                key={post.id}
                post={post}
                onPostClick={handlePostClick}
                onShare={handleShare}
                variant="default"
              />
            ))}
          </Box>
        ) : (
          <BlogEmptyState
            message="No articles available. The news will be automatically updated by our backend service."
            showRefreshButton={false}
          />
        )}

        {/* Pagination */}
        {blogState.posts.length > 0 && blogState.pagination.total > blogState.pagination.limit && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
            <Pagination
              count={Math.ceil(blogState.pagination.total / blogState.pagination.limit)}
              page={blogState.pagination.page}
              onChange={handlePageChange}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
              disabled={blogState.isLoading}
              sx={{
                '& .MuiPaginationItem-root': {
                  borderRadius: 2,
                  fontWeight: 500
                }
              }}
            />
          </Box>
        )}


      </Container>

      {/* Post Detail Dialog */}
      {selectedPost && (
        <BlogPostComponent
          post={selectedPost}
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          onShare={handleShare}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </BlogErrorBoundary>
  );
};

export default BlogHome;
