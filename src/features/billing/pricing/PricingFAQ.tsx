import React from 'react';
import {
  Box, Typography, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const FAQ: { q: string; a: string }[] = [
  {
    q: "What counts as 'Orion usage'?",
    a: 'Each question you ask Orion uses some of your monthly budget. Scheduled briefings count too. The exact accounting is in tokens (the unit the AI model uses) — most users never come close to their tier limit.',
  },
  {
    q: 'What happens if I exceed my Orion budget?',
    a: 'Orion politely stops for the rest of the billing period and you see an upgrade prompt. Your journal and everything else keeps working. Your budget resets at the start of the next billing period.',
  },
  {
    q: 'Can I switch tiers anytime?',
    a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.',
  },
  {
    q: 'What is the refund policy?',
    a: '14-day refund window from the date of purchase. Email us and we will issue the refund through Paddle.',
  },
  {
    q: 'Do you offer team plans?',
    a: 'Not yet. If you need shared journaling for a prop firm or trading team, contact us.',
  },
  {
    q: 'How do I cancel?',
    a: 'From your Account → Billing page, click "Manage subscription" and cancel through the Paddle portal. Your access continues until the end of the current billing period.',
  },
  {
    q: 'Where is my data stored?',
    a: 'All data is stored in Supabase (Postgres) with row-level security. Your trades and notes are accessible only to you and people you explicitly share calendars with.',
  },
];

export const PricingFAQ: React.FC = () => (
  <Box sx={{ mt: 10 }}>
    <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>Frequently asked questions</Typography>
    {FAQ.map((item, idx) => (
      <Accordion key={idx} disableGutters elevation={0}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 500 }}>{item.q}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{item.a}</Typography>
        </AccordionDetails>
      </Accordion>
    ))}
  </Box>
);
