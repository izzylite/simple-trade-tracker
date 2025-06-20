import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Container,
  Card,
  CardContent,
  Stack,
  useTheme,
  alpha,
  Fade,
  Zoom,
  Avatar,
  Paper,
  keyframes
} from '@mui/material';
import {
  TrendingUp,
  Analytics,
  Security,
  Speed,
  CalendarToday,
  Assessment,
  ShowChart,
  ArrowForward,
  PlayArrow,
  CheckCircle,
  Dashboard,
  Insights,
  MonetizationOn
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from './common/AppHeader';
import {
  AnimatedSlideLeft,
  AnimatedSlideRight
} from './Animations';

// Floating animation keyframe
const float = keyframes`
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
`;

interface HomePageProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
  color?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ 
  icon, 
  title, 
  description, 
  delay = 0,
  color = 'primary.main'
}) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Fade in={isVisible} timeout={800}>
      <Card
        sx={{
          height: '100%',
          transition: 'all 0.3s ease-in-out',
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-8px)',
            boxShadow: theme.shadows[8],
            '& .feature-icon': {
              transform: 'scale(1.1) rotate(5deg)',
              color: color
            }
          }
        }}
      >
        <CardContent sx={{ p: 3, textAlign: 'center', height: '100%' }}>
          <Box
            className="feature-icon"
            sx={{
              mb: 2,
              transition: 'all 0.3s ease-in-out',
              color: 'text.secondary'
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </CardContent>
      </Card>
    </Fade>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ 
  icon, 
  value, 
  label, 
  color, 
  delay = 0 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Zoom in={isVisible} timeout={600}>
      <Paper
        elevation={2}
        sx={{
          p: 3,
          textAlign: 'center',
          background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
          border: `1px solid ${alpha(color, 0.2)}`,
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            transform: 'scale(1.05)',
            boxShadow: `0 8px 25px ${alpha(color, 0.3)}`
          }
        }}
      >
        <Box sx={{ color: color, mb: 1 }}>
          {icon}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: color, mb: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Paper>
    </Zoom>
  );
};

const HomePage: React.FC<HomePageProps> = ({ onToggleTheme, mode }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    setHeroVisible(true);
  }, []);

  const handleGetStarted = async () => {
    if (user) {
      navigate('/dashboard');
    } else {
      try {
        await signInWithGoogle();
        navigate('/dashboard');
      } catch (error) {
        console.error('Failed to sign in:', error);
      }
    }
  };

  const features = [
    {
      icon: <CalendarToday sx={{ fontSize: 48 }} />,
      title: 'Trade Calendar',
      description: 'Organize and track your trades with an intuitive calendar interface',
      color: theme.palette.primary.main
    },
    {
      icon: <Analytics sx={{ fontSize: 48 }} />,
      title: 'Performance Analytics',
      description: 'Comprehensive charts and metrics to analyze your trading performance',
      color: theme.palette.secondary.main
    },
    {
      icon: <Security sx={{ fontSize: 48 }} />,
      title: 'Risk Management',
      description: 'Dynamic risk calculation and drawdown monitoring for safer trading',
      color: theme.palette.success.main
    },
    {
      icon: <Assessment sx={{ fontSize: 48 }} />,
      title: 'Trade Scoring',
      description: 'AI-powered scoring system to evaluate your trading discipline and consistency',
      color: theme.palette.warning.main
    },
    {
      icon: <ShowChart sx={{ fontSize: 48 }} />,
      title: 'Advanced Charts',
      description: 'Interactive charts with P&L tracking, win rates, and performance trends',
      color: theme.palette.info.main
    },
    {
      icon: <Dashboard sx={{ fontSize: 48 }} />,
      title: 'Multiple Calendars',
      description: 'Manage multiple trading accounts and strategies with separate calendars',
      color: theme.palette.error.main
    }
  ];

  const stats = [
    {
      icon: <TrendingUp sx={{ fontSize: 32 }} />,
      value: '95%',
      label: 'User Satisfaction',
      color: theme.palette.success.main
    },
    {
      icon: <Speed sx={{ fontSize: 32 }} />,
      value: '10x',
      label: 'Faster Analysis',
      color: theme.palette.primary.main
    },
    {
      icon: <MonetizationOn sx={{ fontSize: 32 }} />,
      value: '$2M+',
      label: 'Trades Tracked',
      color: theme.palette.warning.main
    },
    {
      icon: <Insights sx={{ fontSize: 32 }} />,
      value: '50+',
      label: 'Analytics Features',
      color: theme.palette.secondary.main
    }
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'custom.pageBackground' }}>
      <AppHeader onToggleTheme={onToggleTheme} mode={mode} />
      
      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: 12, pb: 8, position: 'relative' }}>
        {/* Floating background elements */}
        <Box
          sx={{
            position: 'absolute',
            top: '10%',
            right: '10%',
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.1)} 30%, ${alpha(theme.palette.secondary.main, 0.1)} 90%)`,
            animation: `${float} 6s ease-in-out infinite`,
            animationDelay: '0s',
            zIndex: 0
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '60%',
            left: '5%',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `linear-gradient(45deg, ${alpha(theme.palette.success.main, 0.1)} 30%, ${alpha(theme.palette.warning.main, 0.1)} 90%)`,
            animation: `${float} 8s ease-in-out infinite`,
            animationDelay: '2s',
            zIndex: 0
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '30%',
            left: '15%',
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: `linear-gradient(45deg, ${alpha(theme.palette.info.main, 0.1)} 30%, ${alpha(theme.palette.error.main, 0.1)} 90%)`,
            animation: `${float} 7s ease-in-out infinite`,
            animationDelay: '4s',
            zIndex: 0
          }}
        />

        <Fade in={heroVisible} timeout={1000}>
          <Box sx={{ textAlign: 'center', mb: 8, position: 'relative', zIndex: 1 }}>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 800,
                mb: 3,
                background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                position: 'relative'
              }}
            >
              Master Your Trading Journey
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
              sx={{ mb: 4, maxWidth: 600, mx: 'auto', lineHeight: 1.6 }}
            >
              The most comprehensive trading journal and analytics platform. 
              Track, analyze, and improve your trading performance with advanced insights.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent="center"
              sx={{ mb: 6 }}
            >
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                onClick={handleGetStarted}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  borderRadius: 3,
                  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[8]
                  }
                }}
              >
                {user ? 'Go to Dashboard' : 'Get Started Free'}
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<PlayArrow />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  borderRadius: 3,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                Watch Demo
              </Button>
            </Stack>
          </Box>
        </Fade>

        {/* Stats Section */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            mb: 10,
            '& > *': {
              flex: { xs: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }
            }
          }}
        >
          {stats.map((stat, index) => (
            <Box key={index}>
              <StatCard {...stat} delay={index * 200} />
            </Box>
          ))}
        </Box>
      </Container>

      {/* Features Section */}
      <Box sx={{ bgcolor: 'background.paper', py: 10 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 700, mb: 3 }}
            >
              Everything You Need to Excel
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 600, mx: 'auto' }}
            >
              Powerful features designed to help traders of all levels improve their performance
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              '& > *': {
                flex: { xs: '1 1 100%', md: '1 1 calc(50% - 16px)', lg: '1 1 calc(33.333% - 21.33px)' }
              }
            }}
          >
            {features.map((feature, index) => (
              <Box key={index}>
                <FeatureCard
                  {...feature}
                  delay={index * 150}
                />
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Benefits Section */}
      <Container maxWidth="lg" sx={{ py: 10 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
            '& > *': {
              flex: { xs: '1 1 100%', md: '1 1 calc(50% - 24px)' }
            }
          }}
        >
          <Box>
            <AnimatedSlideLeft>
              <Box>
                <Typography
                  variant="h3"
                  component="h2"
                  sx={{ fontWeight: 700, mb: 3 }}
                >
                  Why Choose Trade Tracker?
                </Typography>
                <Stack spacing={3}>
                  {[
                    {
                      icon: <CheckCircle color="success" />,
                      title: 'Comprehensive Analytics',
                      description: 'Get deep insights into your trading patterns with advanced analytics and AI-powered recommendations.'
                    },
                    {
                      icon: <CheckCircle color="success" />,
                      title: 'Risk Management',
                      description: 'Built-in risk management tools help you stay disciplined and protect your capital.'
                    },
                    {
                      icon: <CheckCircle color="success" />,
                      title: 'Easy to Use',
                      description: 'Intuitive interface designed for traders, by traders. Get started in minutes.'
                    },
                    {
                      icon: <CheckCircle color="success" />,
                      title: 'Cloud Sync',
                      description: 'Access your data anywhere with secure cloud synchronization across all devices.'
                    }
                  ].map((benefit, index) => (
                    <Stack key={index} direction="row" spacing={2} alignItems="flex-start">
                      {benefit.icon}
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {benefit.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {benefit.description}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </AnimatedSlideLeft>
          </Box>
          <Box>
            <AnimatedSlideRight>
              <Box
                sx={{
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -20,
                    left: -20,
                    right: 20,
                    bottom: 20,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
                    borderRadius: 4,
                    zIndex: -1
                  }
                }}
              >
                <Paper
                  elevation={8}
                  sx={{
                    p: 4,
                    borderRadius: 3,
                    background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`
                  }}
                >
                  <Stack spacing={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Avatar
                        sx={{
                          width: 80,
                          height: 80,
                          mx: 'auto',
                          mb: 2,
                          bgcolor: 'primary.main'
                        }}
                      >
                        <TrendingUp sx={{ fontSize: 40 }} />
                      </Avatar>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                        +127.5%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Average Performance Improvement
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 2,
                        '& > *': {
                          flex: '1 1 50%'
                        }
                      }}
                    >
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          89%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Win Rate
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          2.4:1
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Risk/Reward
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Paper>
              </Box>
            </AnimatedSlideRight>
          </Box>
        </Box>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          py: 8,
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Animated background particles */}
        {[...Array(6)].map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: 4,
              height: 4,
              borderRadius: '50%',
              bgcolor: alpha('#ffffff', 0.3),
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `${float} ${4 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 700, mb: 3 }}
            >
              Ready to Transform Your Trading?
            </Typography>
            <Typography
              variant="h6"
              sx={{ mb: 4, opacity: 0.9 }}
            >
              Join thousands of traders who have improved their performance with Trade Tracker
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={handleGetStarted}
              sx={{
                px: 6,
                py: 2,
                fontSize: '1.2rem',
                borderRadius: 3,
                bgcolor: 'white',
                color: 'primary.main',
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                  bgcolor: alpha('#ffffff', 0.9),
                  transform: 'translateY(-3px) scale(1.02)',
                  boxShadow: '0 12px 35px rgba(0,0,0,0.3)'
                }
              }}
            >
              {user ? 'Go to Dashboard' : 'Start Free Today'}
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: 'background.paper', py: 4, borderTop: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            © 2024 Trade Tracker. Built for traders, by traders.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
