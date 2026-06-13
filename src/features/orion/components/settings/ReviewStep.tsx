// Step 2 of the wizard (or step 1 in edit mode): user reviews the
// drafted tool config — name, description, the read-only / safe-to-call
// flag, and a collapsed Advanced disclosure with the raw JSON schemas.

import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';

interface Props {
  isEditMode: boolean;
  webhookUrl: string;
  setWebhookUrl: (v: string) => void;
  urlOk: boolean;
  name: string;
  setName: (v: string) => void;
  nameOk: boolean;
  formalDescription: string;
  setFormalDescription: (v: string) => void;
  argsSchemaJson: string;
  setArgsSchemaJson: (v: string) => void;
  sampleArgsJson: string;
  setSampleArgsJson: (v: string) => void;
  isReadOnly: boolean;
  setIsReadOnly: (v: boolean) => void;
}

const ReviewStep: React.FC<Props> = ({
  isEditMode,
  webhookUrl,
  setWebhookUrl,
  urlOk,
  name,
  setName,
  nameOk,
  formalDescription,
  setFormalDescription,
  argsSchemaJson,
  setArgsSchemaJson,
  sampleArgsJson,
  setSampleArgsJson,
  isReadOnly,
  setIsReadOnly,
}) => {
  const { hairline, surfaceInset, monoLabelSx, inputSx } = useDialogTokens();
  return (
    <Stack spacing={1.5}>
      {isEditMode && (
        <Box>
          <Typography sx={monoLabelSx}>Webhook URL</Typography>
          <TextField
            fullWidth
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            size="small"
            error={webhookUrl.length > 0 && !urlOk}
            helperText={
              webhookUrl.length > 0 && !urlOk
                ? 'Must be a valid https:// URL.'
                : "Change the URL? You'll need to re-verify before saving."
            }
            sx={{ ...inputSx, mt: 0.5 }}
          />
        </Box>
      )}
      <Box>
        <Typography sx={monoLabelSx}>Tool name</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 1 }}>
          A short identifier Orion will use internally. Lowercase letters, numbers, and underscores only.
        </Typography>
        <TextField
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          size="small"
          error={name.length > 0 && !nameOk}
          helperText={
            name.length > 0 && !nameOk
              ? `Use only lowercase letters, numbers, and underscores (≤ 54 chars). Got ${name.length}.`
              : undefined
          }
          sx={inputSx}
        />
      </Box>
      <Box>
        <Typography sx={monoLabelSx}>Description</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 1 }}>
          This is what Orion reads to decide when to use your tool. Make it specific. You can include <em>do not call</em> guidance.
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          value={formalDescription}
          onChange={(e) => setFormalDescription(e.target.value)}
          sx={inputSx}
        />
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={isReadOnly}
            onChange={(e) => setIsReadOnly(e.target.checked)}
          />
        }
        label={
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Safe to call repeatedly
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Read-only tools (no side effects) — Orion may cache the response and replay
              it on edit-resend. Leave off for tools that mutate state (place orders, etc.).
            </Typography>
          </Box>
        }
        sx={{ alignItems: 'flex-start' }}
      />

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          border: `1px solid ${hairline}`,
          borderRadius: 1.25,
          '&:before': { display: 'none' },
          backgroundColor: surfaceInset,
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Advanced — tool inputs schema
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Stack spacing={1.5}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Orion drafted this from your description. Only touch it if the input
              fields don't match what your webhook expects.
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={5}
              label="Tool inputs (JSON Schema)"
              value={argsSchemaJson}
              onChange={(e) => setArgsSchemaJson(e.target.value)}
              inputProps={{
                style: { fontFamily: MONO_FONT, fontSize: 13, wordBreak: 'break-word' },
              }}
              sx={inputSx}
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Sample inputs (used for the test fire)"
              value={sampleArgsJson}
              onChange={(e) => setSampleArgsJson(e.target.value)}
              inputProps={{
                style: { fontFamily: MONO_FONT, fontSize: 13, wordBreak: 'break-word' },
              }}
              sx={inputSx}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};

export default ReviewStep;
