// Final step of the wizard: explain what verification does, surface
// gate results once they exist, and show a progress line while the
// audit + test-fire calls are in flight. The trigger button itself
// lives in the dialog footer (parent owns the action).

import React from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { useDialogTokens } from 'styles/dialogTokens';
import type { AuditResult, TestFireResult } from 'features/orion/types/customTool';
import StageGates from './StageGates';

interface Props {
  isEditMode: boolean;
  anyFieldChanged: boolean;
  auditing: boolean;
  testing: boolean;
  auditResult: AuditResult | null;
  testResult: TestFireResult | null;
}

const VerifyStep: React.FC<Props> = ({
  isEditMode,
  anyFieldChanged,
  auditing,
  testing,
  auditResult,
  testResult,
}) => {
  const { violet, violetSoft, violetBorder } = useDialogTokens();
  const verifying = auditing || testing;

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          p: 1.75,
          borderRadius: 1.5,
          border: `1px solid ${violetBorder}`,
          backgroundColor: violetSoft,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.25,
        }}
      >
        <CheckCircleIcon sx={{ fontSize: 18, color: violet, mt: 0.25 }} />
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
            Final check
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {isEditMode
              ? anyFieldChanged
                ? "We'll re-verify the fields you changed before saving."
                : 'No changes detected — change a field on the previous step to enable saving.'
              : "We'll quickly check that Orion can describe your tool safely and that your webhook responds in time before we save it."}
          </Typography>
        </Box>
      </Box>

      {(auditResult || testResult) && (
        <StageGates
          auditing={false}
          testing={false}
          auditResult={auditResult}
          testResult={testResult}
          onAudit={() => {}}
          onTest={() => {}}
        />
      )}

      {!auditResult && !testResult && !verifying && (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          Tap "Run verification" below when you're ready.
        </Typography>
      )}

      {verifying && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1 }}>
          <CircularProgress size={16} thickness={5} sx={{ color: violet }} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {auditing && testing
              ? 'Auditing tool description + test-firing your webhook…'
              : auditing
                ? 'Auditing tool description…'
                : 'Test-firing your webhook (3 calls)…'}
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

export default VerifyStep;
