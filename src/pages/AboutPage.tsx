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
  Event,
  NoteAlt,
  SmartToy,
  TrendingUp,
  Speed,
  EmojiEvents
} from '@mui/icons-material';
import { scrollbarStyles } from '../styles/scrollbarStyles';

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  gradient?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ icon, title, subtitle, children, gradient }) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        borderRadius: 3,
        height: '100%',
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8]
        },
        ...(gradient &&
          (theme.palette.mode === 'light'
            ? {
                background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`
              }
            : {
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(
                  theme.palette.secondary.main,
                  0.08
                )} 100%)`,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
              }))
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
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
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
        <Box sx={{ mt: 1.5 }}>{children}</Box>
      </CardContent>
    </Card>
  );
};

const AboutPage: React.FC = () => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const subsectionTitleSx = {
    fontWeight: 700,
    mb: 0.75,
    mt: 1.75,
    fontSize: '0.75rem',
    letterSpacing: 0.12,
    textTransform: 'uppercase' as const,
    color: theme.palette.text.secondary
  };

  const paragraphSx = {
    mb: 1,
    lineHeight: 1.7
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          py: { xs: 4, sm: 6 },
          px: { xs: 2, sm: 3 }
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Box
              sx={{
                width: { xs: 60, sm: 80 },
                height: { xs: 60, sm: 80 },
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                color: 'primary.contrastText',
                boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                mb: 1
              }}
            >
              <TrendingUp sx={{ fontSize: { xs: 32, sm: 42 } }} />
            </Box>
            <Typography variant={isXs ? 'h4' : 'h3'} sx={{ fontWeight: 800, mb: 1 }}>
              About JournoTrades
            </Typography>
            <Typography
              variant={isXs ? 'body1' : 'h6'}
              color="text.secondary"
              sx={{ maxWidth: 800, fontWeight: 400, lineHeight: 1.6 }}
            >
              A trading journal and analytics workspace to track trades, analyze performance, and gain insights from your data.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" sx={{ mt: 2 }}>
              <Chip
                icon={<Speed />}
                label="Analytics"
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                icon={<SmartToy />}
                label="AI-Powered"
                color="secondary"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                icon={<EmojiEvents />}
                label="Performance Tracking"
                color="success"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          pt: { xs: 4, sm: 6 },
          pb: { xs: 5, sm: 8 },
          px: { xs: 2, sm: 4 },
          maxWidth: 1100,
          mx: 'auto',
          width: '100%',
          ...(scrollbarStyles(theme) as any)
        }}
      >

        

        {/* Features Overview Section */}
        <Box>
          <Divider sx={{ mb: 4 }}>
            <Chip label="Core Features" size="small" />
          </Divider>

          <Typography
            variant={isXs ? 'h5' : 'h4'}
            sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}
          >
            Everything You Need to Master Trading
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4, textAlign: 'center', maxWidth: 700, mx: 'auto', lineHeight: 1.7 }}
          >
            From detailed trade logging to AI-powered insights, JournoTrades provides the tools to analyze and improve your trading.
          </Typography>
        </Box>

        
        

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: { xs: 3, sm: 4 }
          }}
        >
          <SectionCard
            icon={<CalendarMonth fontSize="large" />}
            title="Calendars"
            subtitle="Organise your trading year and accounts"
            gradient
          >
            <Typography variant="body2" sx={{ ...paragraphSx, mb: 2 }}>
              Calendars are containers for your trades, stats, and notes. Use them to represent a trading year, a prop firm account, or a specific strategy. Each calendar tracks performance, risk, and targets.
            </Typography>
            
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: '1fr', md: '1fr' }
              }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ py: 2, px: 2.25 }}>
                  <Typography variant="body2" sx={subsectionTitleSx}>
                    Calendar notes & game plans
                  </Typography>
                  <Typography variant="body2" sx={paragraphSx}>
                    Each calendar has a dedicated note for your strategy, rules, and game plan. The AI assistant uses this note to provide context-aware insights.
                  </Typography>
                </CardContent>
              </Card>

              <Card
                sx={{
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ py: 2, px: 2.25 }}>
                  <Typography variant="body2" sx={subsectionTitleSx}>
                    Daily notes
                  </Typography>
                  <Typography variant="body2" sx={paragraphSx}>
                    Click on any day to add a daily note for your mindset, market observations, or session review.
                  </Typography>
                </CardContent>
              </Card>

              <Card
                sx={{
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ py: 2, px: 2.25 }}>
                  <Typography variant="body2" sx={subsectionTitleSx}>
                    Dynamic risk adjustment
                  </Typography>
                  <Typography variant="body2" sx={paragraphSx}>
                    Enable dynamic risk to automatically adjust your position sizing based on recent performance, helping protect capital during drawdowns and scale up during winning streaks.
                  </Typography>
                </CardContent>
              </Card>

              <Card
                sx={{
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ py: 2, px: 2.25 }}>
                  <Typography variant="body2" sx={subsectionTitleSx}>
                    Performance analytics & score analysis
                  </Typography>
                  <Typography variant="body2" sx={paragraphSx}>
                    Each trade is scored based on rule adherence and risk management. Use scores to identify your best setups and recurring mistakes.
                  </Typography>
                </CardContent>
              </Card>
            </Box>

          </SectionCard>

          <SectionCard
            icon={<ShowChart fontSize="large" />}
            title="Trades & Tags"
            subtitle="Record, import, export and share your trading history"
            gradient
          >
            <Typography variant="body2" sx={{ ...paragraphSx, mb: 2 }}>
              Log your trades with direction, size, PnL, screenshots, notes, and tags. You can import, export, and share your trade data.
            </Typography>
 

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: '1fr', md: '1fr' }
              }}
            >
              <Card
                sx={{
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ py: 2, px: 2.25 }}>
                  <Typography variant="body2" sx={subsectionTitleSx}>
                    Importing & exporting trades
                  </Typography>
                  <Typography variant="body2" sx={paragraphSx}>
                    Import trades from .csv or .xlsx files, and export your data to CSV for backup or external analysis.
                  </Typography>
                </CardContent>
              </Card>

              <Card
                sx={{
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ py: 2, px: 2.25 }}>
                  <Typography variant="body2" sx={subsectionTitleSx}>
                    Group tags & required tag groups
                  </Typography>
                  <Typography variant="body2" sx={paragraphSx}>
                    Organize trades with tags like "Setup:Breakout". Manage tags and create required groups to ensure consistent logging.
                  </Typography>
                </CardContent>
              </Card>

              <Card
                sx={{
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ py: 2, px: 2.25 }}>
                  <Typography variant="body2" sx={subsectionTitleSx}>
                    Gallery mode for screenshots
                  </Typography>
                  <Typography variant="body2" sx={{ ...paragraphSx, mb: 0 }}>
                    Use the gallery mode to visually review all your trade screenshots at once, making it easier to spot patterns.
                  </Typography>
                </CardContent>
              </Card>

              <Card
                sx={{
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper'
                }}
              >
                <CardContent sx={{ py: 2, px: 2.25 }}>
                  <Typography variant="body2" sx={subsectionTitleSx}>
                    Sharing trades
                  </Typography>
                  <Typography variant="body2" sx={{ ...paragraphSx, mb: 0 }}>
                    Generate shareable links for individual trades to discuss setups with mentors or your trading community.
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </SectionCard>

          <SectionCard
            icon={<Event fontSize="large" />}
            title="Economic Events"
            subtitle="Context from the macro calendar"
            gradient
          >
            <Typography variant="body2" sx={{ ...paragraphSx, mb: 2 }}>
              See how high-impact news aligns with your trades with the integrated economic calendar.
            </Typography>

            <Typography variant="body2" sx={subsectionTitleSx}>
              How to use the economic calendar
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.25 }}>
              - From the Home dashboard or calendar page, open the Economic Calendar drawer to see
              upcoming events.
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.25 }}>
              - Filter by impact (High/Medium/Low) and currency to match your trading focus.
            </Typography>
            <Typography variant="body2">
              - When reviewing trades, compare entries and exits against nearby events to understand
              how news affected execution and volatility.
            </Typography>
          </SectionCard>

          <SectionCard
            icon={<NoteAlt fontSize="large" />}
            title="Notes"
            subtitle="Capture rules, reviews and ideas"
            gradient
          >
            <Typography variant="body2" sx={{ ...paragraphSx, mb: 2 }}>
              Store playbooks, checklists, and reviews in a dedicated notes section. You can also attach a detailed note to each calendar.
            </Typography>

            <Typography variant="body2" sx={subsectionTitleSx}>
              Ways to use notes
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.25 }}>
              - Use the Notes entry in the side navigation to open your note library.
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.25 }}>
              - Create new notes for strategies, weekly reviews or psychology work, and pin the most
              important ones.
            </Typography>
            <Typography variant="body2">
              - Use calendar notes to describe the overall plan, rules and context for that trading
              year or account.
            </Typography>
          </SectionCard>


        </Box>

        <Box sx={{ mt: { xs: 4, sm: 6 } }}>
          <SectionCard
            icon={<SmartToy fontSize="large" />}
            title="AI Assistant"
            subtitle="Your personal trading analyst powered by your own data"
            gradient
          >
          <Typography variant="body2" sx={{ ...paragraphSx, mb: 2 }}>
            The AI assistant understands your trading style, rules, and performance. It can search trades, analyze stats, read your notes, and correlate economic events to help you find your edge.
          </Typography>

          <Typography variant="body2" sx={subsectionTitleSx}>
            What the AI assistant can do
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            - Search and filter trades
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            - Calculate custom statistics
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            - Analyze patterns and correlations
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            - Review economic event impact
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            - Visualize your data and generate charts
          </Typography>
          <Typography variant="body2" sx={{ ...paragraphSx, mb: 1.5 }}>
            - Read and reference your notes
          </Typography>

          <Typography variant="body2" sx={subsectionTitleSx}>
            Why Detailed Notes Matter
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            The AI assistant reads your calendar and trade notes to provide personalized insights. A well-written note with your trading plan and rules will improve the AI's analysis.
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            Include details like your strategy, rules for entry and exit, risk management, session preferences, and psychological guidelines.
          </Typography>
           


          <Typography variant="body2">
            - Remember that AI outputs are analytical insights based on your data, not financial
            advice. Use the AI to understand your performance, not to predict future market
            movements.
          </Typography>
        </SectionCard>
        </Box>

        {/* Workflow Section */}
        <Box sx={{ mt: { xs: 5, sm: 7 } }}>
          <Divider sx={{ mb: 4 }}>
            <Chip label="Getting Started" size="small" />
          </Divider>

          <Typography
            variant={isXs ? 'h5' : 'h4'}
            sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}
          >
            Your Journey to Better Trading
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4, textAlign: 'center', maxWidth: 700, mx: 'auto' }}
          >
            Follow these steps to get the most out of the platform.
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
                  'Create a calendar for your account, set balance, drawdown and targets.',
                  'Import external trades from CSV or Excel or manually add your trades.',
                  'Review monthly performance and economic events to understand context.',
                  'Use the AI assistant to surface patterns, weaknesses and opportunities.'
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
      </Box>
    </Box>
  );
};

export default AboutPage;
