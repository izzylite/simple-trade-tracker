import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Toolbar,
  Alert,
  Typography,
  Chip,
  Stack,
  Skeleton,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { createAppTheme } from '../theme';
import { format } from 'date-fns';
import AppHeader from '../components/common/AppHeader';
import RichTextViewer from
  '../components/common/RichTextEditor/RichTextViewer';
import {
  getSharedNote,
  SharedNoteData,
} from '../services/sharingService';

const SharedNotePage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [note, setNote] = useState<SharedNoteData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const theme = useMemo(
    () => createTheme(createAppTheme(mode)),
    [mode]
  );

  useEffect(() => {
    if (!shareId) return;

    const fetchNote = async () => {
      try {
        setLoading(true);
        const data = await getSharedNote(shareId);
        if (data) {
          setNote(data);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [shareId]);

  const formattedDate = note?.shared_at
    ? format(new Date(note.shared_at), 'MMM d, yyyy')
    : '';

  if (!shareId) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            backgroundColor: 'custom.pageBackground',
          }}
        >
          <AppHeader
            onToggleTheme={() =>
              setMode((p) =>
                p === 'light' ? 'dark' : 'light'
              )
            }
            mode={mode}
          />
          <Toolbar />
          <Container maxWidth="md" sx={{ pt: 4 }}>
            <Alert severity="error">
              Invalid share link
            </Alert>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'custom.pageBackground',
        }}
      >
        <AppHeader
          onToggleTheme={() =>
            setMode((p) =>
              p === 'light' ? 'dark' : 'light'
            )
          }
          mode={mode}
        />
        <Toolbar sx={{ pl: 0, pr: 0 }} />

        <Container
          maxWidth="md"
          sx={{
            pt: { xs: 2, sm: 4 },
            pb: { xs: 2, sm: 4 },
            px: { xs: 1, sm: 3 },
          }}
        >
          {loading && (
            <Box>
              <Skeleton
                variant="rectangular"
                height={200}
                sx={{ borderRadius: 2, mb: 3 }}
              />
              <Skeleton width="60%" height={40} />
              <Skeleton width="30%" height={20} />
              <Skeleton height={200} sx={{ mt: 3 }} />
            </Box>
          )}

          {error && (
            <Alert severity="error">
              Note not found or sharing has been disabled
            </Alert>
          )}

          {!loading && !error && note && (
            <Box>
              {/* Cover Image */}
              {note.cover_image && (
                <Box
                  sx={{
                    width: '100%',
                    height: 220,
                    backgroundImage:
                      `url(${note.cover_image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 2,
                    mb: 3,
                  }}
                />
              )}

              {/* Tags */}
              {note.tags.length > 0 && (
                <Stack
                  direction="row"
                  spacing={0.5}
                  flexWrap="wrap"
                  sx={{ mb: 2 }}
                >
                  {note.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        bgcolor: 'secondary.main',
                        color: 'secondary.contrastText',
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  ))}
                </Stack>
              )}

              {/* Title */}
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                  mb: 2,
                  wordBreak: 'break-word',
                }}
              >
                {note.title || 'Untitled'}
              </Typography>

              {/* Date */}
              {formattedDate && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 3, display: 'block' }}
                >
                  Shared {formattedDate}
                </Typography>
              )}

              {/* Content */}
              <Box sx={{ mt: 3 }}>
                {note.content ? (
                  <RichTextViewer
                    content={note.content}
                  />
                ) : (
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic' }}
                  >
                    No content
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default SharedNotePage;
