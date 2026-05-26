// Step 1 of the create wizard: trader writes a plain-English description
// of their tool + provides the webhook URL. Tapping Next on the parent
// fires Gemini's draft-schema call and advances on success.

import React from 'react';
import { Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useDialogTokens } from 'styles/dialogTokens';

interface Props {
  description: string;
  setDescription: (v: string) => void;
  webhookUrl: string;
  setWebhookUrl: (v: string) => void;
  urlOk: boolean;
  drafting: boolean;
}

const DescribeStep: React.FC<Props> = ({
  description,
  setDescription,
  webhookUrl,
  setWebhookUrl,
  urlOk,
  drafting,
}) => {
  const { violet, monoLabelSx, inputSx } = useDialogTokens();
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography sx={monoLabelSx}>What does your tool do?</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 1 }}>
          Describe it in plain English. Orion uses this to figure out when to call your tool.
        </Typography>
        <TextField
          multiline
          fullWidth
          minRows={3}
          maxRows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='e.g. "Returns my proprietary Squeeze indicator signal for a given symbol and timeframe."'
          disabled={drafting}
          sx={inputSx}
        />
      </Box>
      <Box>
        <Typography sx={monoLabelSx}>Webhook URL</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 1 }}>
          Where can Orion reach your tool? Must start with <code>https://</code>.
        </Typography>
        <TextField
          fullWidth
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-domain.com/orion-hook"
          size="small"
          error={webhookUrl.length > 0 && !urlOk}
          helperText={
            webhookUrl.length > 0 && !urlOk
              ? 'Must be a valid https:// URL.'
              : undefined
          }
          disabled={drafting}
          sx={inputSx}
        />
      </Box>
      {drafting && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1 }}>
          <CircularProgress size={16} thickness={5} sx={{ color: violet }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Drafting a calling schema for your tool…
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

export default DescribeStep;
