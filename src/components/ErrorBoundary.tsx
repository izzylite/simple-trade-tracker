import React, { Component, ErrorInfo } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { keyframes } from '@mui/system';
import { error } from '../utils/logger';

const shake = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-5px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(5px);
  }
`;

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(err: Error, errorInfo: ErrorInfo) {
    this.setState({
      error: err,
      errorInfo
    });
    // You can also log the error to an error reporting service here
    error('Error caught by ErrorBoundary:', err, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            bgcolor: 'background.default',
            p: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 600,
              width: '100%',
              textAlign: 'center',
              animation: `${shake} 0.5s ease-in-out`,
              bgcolor: 'background.paper'
            }}
          >
            <ErrorIcon
              color="error"
              sx={{
                fontSize: 64,
                mb: 2,
                animation: `${shake} 0.5s ease-in-out`
              }}
            />
            <Typography variant="h5" gutterBottom color="error">
              Oops! Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              We're sorry, but an error occurred while trying to display this content.
              Please try refreshing the page or contact support if the problem persists.
            </Typography>
            {this.state.error && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: 'background.default',
                  maxHeight: 200,
                  overflow: 'auto',
                  textAlign: 'left'
                }}
              >
                <Typography variant="body2" component="pre" sx={{ m: 0 }}>
                  {this.state.error.toString()}
                </Typography>
              </Paper>
            )}
            <Button
              variant="contained"
              color="primary"
              startIcon={<RefreshIcon />}
              onClick={this.handleRefresh}
              sx={{
                minWidth: 200,
                '&:hover': {
                  transform: 'translateY(-1px)'
                },
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              Refresh Page
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 