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
  alpha,
  Grid,
} from '@mui/material';
import {
  CalendarMonth,
  ShowChart,
  SmartToy,
  Event,
  BarChart,
  Security,
  StickyNote2,
} from '@mui/icons-material';
import { scrollbarStyles } from '../styles/scrollbarStyles';

interface FeatureSectionProps {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
  delay?: number;
}

const FeatureSection: React.FC<FeatureSectionProps> = ({
  icon, eyebrow, title, subtitle, children, imageSrc, imageAlt, reverse = false, delay = 0,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        py: { xs: 5, md: 7 },
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        animation: `fadeInUp 0.6s ease-out ${delay}s both`,
        '@keyframes fadeInUp': {
          from: { opacity: 0, transform: 'translateY(24px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      <Grid
        container
        spacing={{ xs: 4, md: 8 }}
        alignItems="center"
        direction={isMobile ? 'column' : reverse ? 'row-reverse' : 'row'}
      >
        {/* Text side */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
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
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
              }}
            >
              {icon}
            </Box>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: theme.palette.primary.main,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              {eyebrow}
            </Typography>
          </Stack>

          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500, mb: 2.5, lineHeight: 1.6 }}>
            {subtitle}
          </Typography>

          <Box sx={{ '& .MuiTypography-root': { lineHeight: 1.75, mb: 1.5 } }}>
            {children}
          </Box>
        </Grid>

        {/* Image side */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Box
            sx={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.15 : 0.3)}`,
              boxShadow: isDark
                ? '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
                : '0 12px 40px rgba(0,0,0,0.12)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: isDark
                  ? '0 28px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)'
                  : '0 20px 60px rgba(0,0,0,0.18)',
              },
            }}
          >
            <Box
              component="img"
              src={imageSrc}
              alt={imageAlt}
              sx={{ width: '100%', display: 'block', objectFit: 'cover', objectPosition: 'top' }}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

const AboutPage: React.FC = () => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  const paragraphSx = {
    mb: 1.5,
    lineHeight: 1.75,
    fontSize: '0.975rem',
    color: theme.palette.text.secondary,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      {/* Hero Section */}
      <Box
        sx={{
          position: 'relative',
          py: { xs: 8, sm: 12 },
          px: { xs: 2, sm: 3 },
          overflow: 'hidden',
          bgcolor: '#000',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          // Dot grid
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 80% 100% at 50% 0%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 100% at 50% 0%, black 40%, transparent 100%)',
          },
          // Purple glow
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            height: '600px',
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 65%)',
            pointerEvents: 'none',
          },
          '@keyframes scaleUp': {
            from: { opacity: 0, transform: 'scale(0.8)' },
            to: { opacity: 1, transform: 'scale(1)' },
          },
          '@keyframes fadeInUp': {
            from: { opacity: 0, transform: 'translateY(20px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Stack spacing={2.5} alignItems="center" textAlign="center">
            <Box
              component="img"
              src="/android-chrome-192x192.png"
              alt="JournoTrades"
              sx={{
                width: { xs: 72, sm: 88 },
                height: { xs: 72, sm: 88 },
                borderRadius: '22px',
                boxShadow: '0 8px 32px rgba(124,58,237,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
                animation: 'scaleUp 0.5s ease-out both',
              }}
            />
            <Typography
              variant={isXs ? 'h4' : 'h3'}
              sx={{
                fontWeight: 800,
                color: '#fff',
                animation: 'fadeInUp 0.6s ease-out 0.2s both',
                letterSpacing: '-0.03em',
              }}
            >
              JournoTrades
            </Typography>
            <Typography
              variant={isXs ? 'h6' : 'h5'}
              sx={{
                maxWidth: 600,
                fontWeight: 400,
                lineHeight: 1.7,
                color: 'rgba(255,255,255,0.5)',
                animation: 'fadeInUp 0.6s ease-out 0.4s both',
              }}
            >
              Track your trades, organize your strategy, and let AI uncover insights from your data.
            </Typography>
          </Stack>
        </Container>
      </Box>

      {/* Feature Sections */}
      <Container
        maxWidth="lg"
        sx={{
          pt: { xs: 4, sm: 6 },
          pb: { xs: 6, sm: 9 },
          position: 'relative',
          zIndex: 1,
          ...(scrollbarStyles(theme) as any),
        }}
      >
        {/* Calendars */}
        <FeatureSection
          icon={<CalendarMonth />}
          eyebrow="Calendars"
          title="Organize your trading accounts and strategies"
          subtitle="Calendars are containers for your trades and performance data."
          imageSrc="/asset/new_calendar.png"
          imageAlt="Trading Calendar"
          reverse={false}
          delay={0.1}
        >
          <Typography variant="body2" sx={paragraphSx}>
            Create a calendar for each trading year, prop firm account, or strategy you want to track separately.
            Each calendar tracks your balance, risk settings, profit targets, and performance statistics.
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            Add daily notes to any day on the calendar to record your mindset, market observations, or session reviews.
          </Typography>
          <Typography variant="body2" sx={{ ...paragraphSx, mb: 0 }}>
            Enable dynamic risk adjustment to automatically scale your position sizing based on recent performance,
            protecting capital during drawdowns and growing during winning streaks.
          </Typography>
        </FeatureSection>

        {/* Trades */}
        <FeatureSection
          icon={<ShowChart />}
          eyebrow="Trades"
          title="Log and analyze every trade"
          subtitle="Record your trades with all the details that matter."
          imageSrc="/asset/new_calendar_trades.png"
          imageAlt="Trading Calendar Grid"
          reverse={true}
          delay={0.15}
        >
          <Typography variant="body2" sx={paragraphSx}>
            Capture direction, instrument, size, entry and exit prices, PnL, screenshots, and detailed notes.
            Organize trades with tags like "Setup:Breakout" or "Session:London" with required tag groups for consistency.
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            Import trades from CSV or Excel files, export your data for backup, and use gallery mode to review
            all your trade screenshots at once.
          </Typography>
          <Typography variant="body2" sx={{ ...paragraphSx, mb: 0 }}>
            Each trade is scored based on rule adherence and risk management, helping you identify your best
            setups and recurring mistakes.
          </Typography>
        </FeatureSection>

        {/* Notes */}
        <FeatureSection
          icon={<StickyNote2 />}
          eyebrow="Trade Notes"
          title="Capture every detail with rich notes"
          subtitle="Document your thinking with a full rich text editor."
          imageSrc="/asset/new_notes.png"
          imageAlt="Trade Notes"
          reverse={false}
          delay={0.2}
        >
          <Typography variant="body2" sx={paragraphSx}>
            Write detailed trade notes using the built-in rich text editor. Capture your pre-trade thesis,
            execution commentary, and post-trade review in one place.
          </Typography>
          <Typography variant="body2" sx={{ ...paragraphSx, mb: 0 }}>
            Good notes are the foundation of improvement. The more detail you capture, the more the AI
            assistant can help you identify what's working and what isn't.
          </Typography>
        </FeatureSection>

        {/* AI Assistant */}
        <FeatureSection
          icon={<SmartToy />}
          eyebrow="AI Assistant"
          title="Your personal trading analyst"
          subtitle="Ask questions about your trading history in plain language."
          imageSrc="/asset/new_ai.png"
          imageAlt="AI Trading Assistant"
          reverse={true}
          delay={0.25}
        >
          <Typography variant="body2" sx={paragraphSx}>
            The AI assistant reads your trades, calendar notes, and performance data to provide personalized
            insights. Ask: "Show me my best performing setups", "Why am I losing on Fridays?", or "Compare
            my long vs short trades."
          </Typography>
          <Typography variant="body2" sx={paragraphSx}>
            It can generate charts, analyze correlations, and help you understand what's working and what's
            not. The more detailed your notes, the better the AI can help you.
          </Typography>
          <Typography variant="body2" sx={{ ...paragraphSx, mb: 0, fontStyle: 'italic' }}>
            Note: AI outputs are analytical insights based on your data, not financial advice.
          </Typography>
        </FeatureSection>

        {/* Economic Calendar */}
        <FeatureSection
          icon={<Event />}
          eyebrow="Economic Calendar"
          title="Stay ahead of market-moving events"
          subtitle="Track high-impact economic events directly on your calendar."
          imageSrc="/asset/new_events.png"
          imageAlt="Economic Calendar"
          reverse={false}
          delay={0.3}
        >
          <Typography variant="body2" sx={paragraphSx}>
            Never be caught off guard by NFP or FOMC again. Filter events by currency and importance
            to focus on what matters to your trading pairs.
          </Typography>
          <Typography variant="body2" sx={{ ...paragraphSx, mb: 0 }}>
            See exactly which events were active during your trades to understand how news impacts your
            performance and execution.
          </Typography>
        </FeatureSection>

        {/* Performance Analytics */}
        <FeatureSection
          icon={<BarChart />}
          eyebrow="Performance Analytics"
          title="Deep dive into your trading metrics"
          subtitle="Visualize your progress with interactive charts and statistics."
          imageSrc="/asset/new_performance.png"
          imageAlt="Performance Analytics"
          reverse={true}
          delay={0.35}
        >
          <Typography variant="body2" sx={paragraphSx}>
            Interactive charts show equity curves, daily PnL, and win rates over time. Analyze your
            performance by time of day, day of week, or specific tags to find your sweet spots.
          </Typography>
          <Typography variant="body2" sx={{ ...paragraphSx, mb: 0 }}>
            Monitor key metrics like Profit Factor, Average R:R, and Expectancy to ensure your edge
            is sustainable and scalable.
          </Typography>
        </FeatureSection>

        {/* Data Privacy — text only */}
        <Box
          sx={{
            py: { xs: 5, md: 6 },
            animation: 'fadeInUp 0.6s ease-out 0.4s both',
            '@keyframes fadeInUp': {
              from: { opacity: 0, transform: 'translateY(24px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
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
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
              }}
            >
              <Security />
            </Box>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: theme.palette.primary.main,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              Data Privacy & Security
            </Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.02em' }}>
            Your data belongs to you
          </Typography>
          <Box sx={{ maxWidth: 680 }}>
            <Typography variant="body2" sx={paragraphSx}>
              Your trading data is stored securely. We prioritize your privacy and data ownership.
            </Typography>
            <Typography variant="body2" sx={paragraphSx}>
              We do not have access to your brokerage accounts or funds. This is a journaling tool, not a
              trading execution platform.
            </Typography>
            <Typography variant="body2" sx={{ ...paragraphSx, mb: 0 }}>
              You can export your data at any time in standard formats or delete your account completely
              if you choose to leave.
            </Typography>
          </Box>
        </Box>

        {/* Getting Started */}
        <Box
          sx={{
            mt: { xs: 2, sm: 4 },
            animation: 'fadeInUp 0.6s ease-out 0.45s both',
            '@keyframes fadeInUp': {
              from: { opacity: 0, transform: 'translateY(20px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
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
              bgcolor: 'background.paper',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Stack spacing={2.5}>
                {[
                  'Create a calendar and set your starting balance, risk limits, and profit targets.',
                  'Log your trades manually or import them from CSV or Excel files.',
                  'Review your performance statistics and identify patterns in your trading.',
                  'Ask the AI assistant questions to uncover insights and improve your edge.',
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
                        flexShrink: 0,
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
              bgcolor: 'background.paper',
              border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <CardContent
              sx={{
                p: { xs: 3, sm: 4 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: { xs: 2, sm: 3 },
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
                    mr: 1,
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
                      boxShadow: theme.shadows[4],
                    },
                    transition: 'all 0.2s ease-in-out',
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
