import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Link,
  ButtonBase,
  useTheme,
  alpha,
} from '@mui/material';
import FAQDrawer from 'components/faq/FAQDrawer';

// Bumped manually per release. CRA does not expose npm_package_version, and
// importing package.json from outside `src` falls outside the tsconfig include.
const APP_VERSION = '0.1.0';
const DISCORD_URL = 'https://discord.gg/9Dt2fNVpr';

interface TourRowProps {
  label: string;
  title: string;
  body: string;
}

const TourRow: React.FC<TourRowProps> = ({ label, title, body }) => {
  const theme = useTheme();
  return (
    <Box
      component="section"
      sx={{
        py: { xs: 3, sm: 3.5 },
        textAlign: 'center',
        borderTop: `1px solid ${theme.palette.divider}`,
        '&:last-of-type': {
          borderBottom: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <Typography
        component="h2"
        sx={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.palette.text.secondary,
          mb: 1.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '1.125rem',
          fontWeight: 600,
          letterSpacing: '-0.015em',
          lineHeight: 1.4,
          color: theme.palette.text.primary,
          mb: 0.75,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.9375rem',
          lineHeight: 1.6,
          color: theme.palette.text.secondary,
          maxWidth: '62ch',
          mx: 'auto',
        }}
      >
        {body}
      </Typography>
    </Box>
  );
};

interface UtilityLinkProps {
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}

const UtilityLink: React.FC<UtilityLinkProps> = ({
  label,
  onClick,
  href,
  external,
}) => {
  const theme = useTheme();
  const sharedSx = {
    display: 'inline-block',
    py: 0.5,
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: theme.palette.text.primary,
    textDecoration: 'none',
    borderRadius: 0.75,
    transition: 'color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    '&:hover': {
      color: theme.palette.primary.main,
      textDecoration: 'underline',
      textUnderlineOffset: '4px',
      textDecorationThickness: '1px',
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: theme.palette.custom.focusRing,
      color: theme.palette.primary.main,
    },
  } as const;

  if (href) {
    return (
      <Link
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        sx={sharedSx}
      >
        {label}
      </Link>
    );
  }

  return (
    <ButtonBase
      onClick={onClick}
      disableRipple
      sx={{
        ...sharedSx,
        textAlign: 'left',
        font: 'inherit',
      }}
    >
      {label}
    </ButtonBase>
  );
};

const AboutPage: React.FC = () => {
  const theme = useTheme();
  const [faqOpen, setFaqOpen] = useState(false);

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        justifyContent: 'center',
        px: { xs: 2.5, sm: 4 },
        py: { xs: 4, sm: 6 },
      }}
    >
      <Box
        component="main"
        sx={{
          width: '100%',
          maxWidth: 720,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Identity */}
        <Box
          component="header"
          sx={{
            mb: { xs: 4, sm: 5 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <Box
            component="img"
            src="/android-chrome-192x192.png"
            alt=""
            aria-hidden
            sx={{
              width: 64,
              height: 64,
              borderRadius: '14px',
              display: 'block',
              mb: 2.5,
            }}
          />
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '1.75rem', sm: '2.125rem' },
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              color: theme.palette.text.primary,
            }}
          >
            JournoTrades
          </Typography>
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              mt: 1.25,
              px: 1,
              py: 0.25,
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              fontSize: '0.75rem',
              fontWeight: 500,
              letterSpacing: '0.02em',
              color: theme.palette.text.secondary,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '999px',
              lineHeight: 1.5,
            }}
          >
            v{APP_VERSION}
          </Box>

          <Typography
            sx={{
              mt: 2.5,
              fontSize: { xs: '1rem', sm: '1.0625rem' },
              lineHeight: 1.6,
              color: theme.palette.text.secondary,
              maxWidth: '56ch',
            }}
          >
            A structured trading journal for traders who treat the work like work.
            Log every trade, write what you saw, watch performance compound, and ask
            an AI assistant what is actually working.
          </Typography>
        </Box>

        {/* Tour — mirrors the primary side-nav surfaces. */}
        <Box sx={{ mb: { xs: 4, sm: 5 } }}>
          <TourRow
            label="Home · Calendars"
            title="One calendar per strategy or account"
            body="Each calendar holds its own balance, risk rules, profit targets, tags, and trade history. Set a max daily drawdown, default risk per trade, and dynamic risk to scale size after a profit threshold. High-impact economic events surface on the grid so you know what news touched each day."
          />
          <TourRow
            label="Trades"
            title="Log direction, size, P&L, screenshots, tags"
            body="Capture every trade with required tag groups so the journal stays consistent. Import from CSV or Excel, export anytime, and review screenshots in gallery mode. Each trade is scored for rule adherence and risk discipline."
          />
          <TourRow
            label="Performance"
            title="Cross-calendar analytics, not just totals"
            body="Equity curve, daily P&L, win rate, profit factor, expectancy, and average R:R. Slice performance by tag, session, day of week, or calendar to find the setups carrying the account and the ones leaking it."
          />
          <TourRow
            label="Assistant · Orion"
            title="Asks your data the questions you would"
            body="Orion reads your trades, notes, and stats. Ask about your worst Fridays, your best setups after news, or how long versus short compared this month. Charts and comparisons render inline. Insight, not financial advice."
          />
          <TourRow
            label="Notes"
            title="Rich journal across every calendar"
            body="Day notes for mindset and session reviews, trade notes for the thinking behind the entry, and standalone notes for plans and weekly recaps. Tag, attach images, set reminders, and search across calendars from one page."
          />
        </Box>

        {/* Utility */}
        <Box
          component="nav"
          aria-label="More links"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            columnGap: 4,
            rowGap: 3,
            mb: { xs: 5, sm: 6 },
            textAlign: 'center',
          }}
        >
          <Box>
            <Typography
              component="h2"
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.palette.text.secondary,
                mb: 1.5,
              }}
            >
              Reference
            </Typography>
            <Stack spacing={0.25} alignItems="center">
              <UtilityLink label="FAQ" onClick={() => setFaqOpen(true)} />
            </Stack>
          </Box>
          <Box>
            <Typography
              component="h2"
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.palette.text.secondary,
                mb: 1.5,
              }}
            >
              Community
            </Typography>
            <Stack spacing={0.25} alignItems="center">
              <UtilityLink label="Discord" href={DISCORD_URL} external />
            </Stack>
          </Box>
        </Box>

        {/* Footer line */}
        <Box
          component="footer"
          sx={{
            pt: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            textAlign: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.8125rem',
              color: theme.palette.text.secondary,
              fontFeatureSettings: '"tnum" on, "lnum" on',
            }}
          >
            JournoTrades · v{APP_VERSION} · © {new Date().getFullYear()}
          </Typography>
          <Typography
            sx={{
              mt: 0.75,
              fontSize: '0.75rem',
              color: theme.palette.text.disabled,
              maxWidth: '60ch',
              mx: 'auto',
              lineHeight: 1.55,
            }}
          >
            Journaling tool, not a brokerage. Not financial advice. Your data stays yours.
          </Typography>
        </Box>
      </Box>

      <FAQDrawer open={faqOpen} onClose={() => setFaqOpen(false)} />
    </Box>
  );
};

export default AboutPage;
