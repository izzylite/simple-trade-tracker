import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  useTheme,
  useMediaQuery,
  Container,
  Divider,
  alpha
} from '@mui/material';
import {
  CalendarMonth,
  ShowChart,
  SmartToy,
  TrendingUp
} from '@mui/icons-material';
import { scrollbarStyles } from '../styles/scrollbarStyles';

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ icon, title, subtitle, children }) => {
  const theme = useTheme();

  return (
    <Box>
      <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 2.5 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'primary.contrastText',
            flexShrink: 0,
            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      <Box sx={{ pl: { xs: 0, sm: '72px' } }}>{children}</Box>
    </Box>
  );
};

const AboutPage: React.FC = () => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const paragraphSx = {
    mb: 1.5,
    lineHeight: 1.7,
    fontSize: '1rem'
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          py: { xs: 5, sm: 8 },
          px: { xs: 2, sm: 3 }
        }}
      >
        <Container maxWidth="md">
          <Stack spacing={2.5} alignItems="center" textAlign="center">
            <Box
              sx={{
                width: { xs: 64, sm: 72 },
                height: { xs: 64, sm: 72 },
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                color: 'primary.contrastText',
                boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`
              }}
            >
              <TrendingUp sx={{ fontSize: { xs: 36, sm: 40 } }} />
            </Box>
            <Typography variant={isXs ? 'h4' : 'h3'} sx={{ fontWeight: 800 }}>
              JournoTrades
            </Typography>
            <Typography
              variant={isXs ? 'h6' : 'h5'}
              color="text.secondary"
              sx={{ maxWidth: 600, fontWeight: 400, lineHeight: 1.7 }}
            >
              Track your trades, organize your strategy, and let AI uncover insights from your data.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container
        maxWidth="md"
        sx={{
          pt: { xs: 5, sm: 7 },
          pb: { xs: 6, sm: 9 },
          ...(scrollbarStyles(theme) as any)
        }}
      >
        <Stack spacing={5}>
          {/* Calendars Section */}
          <Section
            icon={<CalendarMonth fontSize="large" />}
            title="Calendars"
            subtitle="Organize your trading accounts and strategies"
          >
            <Typography variant="body1" sx={paragraphSx}>
              Calendars are containers for your trades and performance data. Create a calendar for each trading year, prop firm account, or strategy you want to track separately.
            </Typography>
            <Typography variant="body1" sx={paragraphSx}>
              Each calendar tracks your balance, risk settings, profit targets, and performance statistics. Add daily notes to any day on the calendar to record your mindset, market observations, or session reviews.
            </Typography>
            <Typography variant="body1" sx={{ ...paragraphSx, mb: 0 }}>
              Enable dynamic risk adjustment to automatically scale your position sizing based on recent performance, protecting capital during drawdowns and growing during winning streaks.
            </Typography>
          </Section>

          {/* Trades Section */}
          <Section
            icon={<ShowChart fontSize="large" />}
            title="Trades"
            subtitle="Log and analyze every trade"
          >
            <Typography variant="body1" sx={paragraphSx}>
              Record your trades with all the details that matter: direction, instrument, size, entry and exit prices, PnL, screenshots, and detailed notes.
            </Typography>
            <Typography variant="body1" sx={paragraphSx}>
              Organize trades with tags like "Setup:Breakout" or "Session:London". Create required tag groups to ensure you log consistent information for every trade.
            </Typography>
            <Typography variant="body1" sx={paragraphSx}>
              Import trades from CSV or Excel files, export your data for backup, and use gallery mode to review all your trade screenshots at once.
            </Typography>
            <Typography variant="body1" sx={{ ...paragraphSx, mb: 0 }}>
              Each trade is scored based on rule adherence and risk management, helping you identify your best setups and recurring mistakes.
            </Typography>
          </Section>

          {/* AI Assistant Section */}
          <Section
            icon={<SmartToy fontSize="large" />}
            title="AI Assistant"
            subtitle="Your personal trading analyst"
          >
            <Typography variant="body1" sx={paragraphSx}>
              The AI assistant reads your trades, calendar notes, and performance data to provide personalized insights about your trading.
            </Typography>
            <Typography variant="body1" sx={paragraphSx}>
              Ask questions in plain language: "Show me my best performing setups", "Why am I losing on Fridays?", or "Compare my long vs short trades". The AI will search your data, calculate statistics, and explain patterns it finds.
            </Typography>
            <Typography variant="body1" sx={paragraphSx}>
              It can generate charts, analyze correlations, and help you understand what's working and what's not. The more detailed your trade notes and calendar game plan, the better the AI can help you.
            </Typography>
            <Typography variant="body1" sx={{ ...paragraphSx, mb: 0, fontStyle: 'italic' }}>
              Note: AI outputs are analytical insights based on your data, not financial advice.
            </Typography>
          </Section>
        </Stack>

        {/* Workflow Section */}
        <Box sx={{ mt: { xs: 6, sm: 8 } }}>
          <Divider sx={{ mb: 4 }}>
            <Chip label="Getting Started" size="small" />
          </Divider>

          <Typography
            variant={isXs ? 'h5' : 'h4'}
            sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}
          >
            How to Get Started
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4, textAlign: 'center', maxWidth: 600, mx: 'auto', lineHeight: 1.7 }}
          >
            Follow these simple steps to start improving your trading.
          </Typography>

          <Card
            sx={{
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.03)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Stack spacing={2.5}>
                {[
                  'Create a calendar and set your starting balance, risk limits, and profit targets.',
                  'Log your trades manually or import them from CSV or Excel files.',
                  'Review your performance statistics and identify patterns in your trading.',
                  'Ask the AI assistant questions to uncover insights and improve your edge.'
                ].map((step, index) => (
                  <Stack key={step} direction="row" spacing={2} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        color: 'primary.contrastText',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        flexShrink: 0
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Typography variant="body1" sx={{ pt: 0.5, lineHeight: 1.7 }}>
                      {step}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        {/* Discord CTA */}
        <Box sx={{ mt: { xs: 5, sm: 6 }, mb: { xs: 2, sm: 3 } }}>
          <Card
            sx={{
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
              border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`
            }}
          >
            <CardContent
              sx={{
                p: { xs: 3, sm: 4 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: { xs: 2, sm: 3 }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 1
                  }}
                >
                  <Box
                    component="img"
                    src="/discord-icon-svgrepo-com.svg"
                    alt="Discord icon"
                    sx={{ width: 28, height: 28, display: 'block' }}
                  />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Join Our Community
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    Connect with fellow traders, share strategies, and get support on our Discord.
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Chip
                  component="a"
                  clickable
                  label="Join Discord"
                  href="https://discord.gg/9Dt2fNVpr"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontWeight: 700,
                    px: 3,
                    py: 2.5,
                    fontSize: '1rem',
                    bgcolor: '#5865F2',
                    color: '#ffffff',
                    '&:hover': {
                      bgcolor: '#4752C4',
                      transform: 'scale(1.05)',
                      boxShadow: theme.shadows[4]
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
};

export default AboutPage;
