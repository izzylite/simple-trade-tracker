// Static reference docs shown inside the register/edit dialog. Pure
// presentation — no state, no props beyond the theme it implicitly reads
// via the preBox helper. Lifts ~100 lines out of CustomToolFormDialog
// so the parent file stays under the 500-line cap.

import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CodeOutlined as CodeIcon,
} from '@mui/icons-material';
import { preBox } from './customToolFormHelpers';

const WebhookDocsAccordion: React.FC = () => {
  const theme = useTheme();
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        '&:before': { display: 'none' },
        backgroundColor: 'transparent',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Implementing your webhook
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, fontSize: '0.8125rem' }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              Request — headers Orion sends
            </Typography>
            <Box component="pre" sx={preBox(theme)}>
{`Content-Type: application/json
X-Orion-Signature: <hex(HMAC-SHA256(secret, body))>
X-Orion-Tool: user_tool_<your_name>
X-Orion-Idempotency-Key: <conversation_id>:<uuid>`}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              Request — body shape
            </Typography>
            <Box component="pre" sx={preBox(theme)}>
{`{
  "tool_name": "user_tool_<your_name>",
  "args": { /* fields per your args_schema */ },
  "user_id": "<uuid>",
  "conversation_id": "<uuid|null>",
  "idempotency_key": "<conversation_id>:<uuid>"
}`}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              Signature verification (Node.js)
            </Typography>
            <Box component="pre" sx={preBox(theme)}>
{`const crypto = require('crypto');
const expected = crypto
  .createHmac('sha256', YOUR_SECRET)  // pass the 64-char hex string AS-IS
  .update(rawBody)                     // bytes-exact, BEFORE JSON parsing
  .digest('hex');
// IMPORTANT: use timingSafeEqual, not === — string compare leaks timing.
const sig = req.headers['x-orion-signature'] ?? '';
const ok =
  sig.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));`}
            </Box>
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
            >
              <strong>Three footguns:</strong> (1) hash the RAW request body, not the JSON-parsed
              object — any whitespace or key-order change invalidates the signature. (2) pass
              the secret string AS-IS, NOT a hex-decode of it — Orion HMACs over the 64-char
              hex string itself, not the underlying 32 bytes. (3) use a constant-time compare
              (<code>crypto.timingSafeEqual</code> in Node, equivalent elsewhere) — string{' '}
              <code>===</code> leaks per-byte timing and is a known signature-bypass footgun.
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              Response contract
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              • Return HTTP 2xx with <code>Content-Type: application/json</code>
              <br />
              • Body must be a JSON object or array, under 256 KB
              <br />
              • Must respond within 5 seconds (Orion aborts the call after that)
              <br />
              • Failures (timeout, non-2xx, bad shape) increment a counter; 10 consecutive failures auto-disable the tool
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
              Idempotency
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              Gemini may call the same tool concurrently within one turn,
              and edit-resend can re-fire prior calls. The
              <code> X-Orion-Idempotency-Key </code>
              header is a deterministic hash of (conversation, tool, args) —
              dedupe on it server-side if your endpoint mutates state.
            </Typography>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

export default WebhookDocsAccordion;
