// Stage 3 of the register/edit flow: audit + test-fire buttons and their
// result display. Self-contained — receives state/handlers as props.

import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { EYEBROW_SX } from 'styles/designTokens';
import type { AuditResult, TestFireResult } from 'features/orion/types/customTool';
import GateChip from './GateChip';

interface Props {
  auditing: boolean;
  testing: boolean;
  auditResult: AuditResult | null;
  testResult: TestFireResult | null;
  onAudit: () => void;
  onTest: () => void;
}

const StageGates: React.FC<Props> = ({
  auditing,
  testing,
  auditResult,
  testResult,
  onAudit,
  onTest,
}) => {
  return (
    <Box>
      <Typography sx={{ ...EYEBROW_SX, color: 'text.tertiary' }}>
        3. Run gates
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ mt: 1 }}
      >
        <Button onClick={onAudit} disabled={auditing} variant="outlined" size="small">
          {auditing ? <CircularProgress size={16} /> : 'Run audit'}
        </Button>
        <Button onClick={onTest} disabled={testing} variant="outlined" size="small">
          {testing ? <CircularProgress size={16} /> : 'Test-fire webhook'}
        </Button>
      </Stack>

      {auditResult && (
        <Box sx={{ mt: 1.5 }}>
          <GateChip label="Audit" status={auditResult.status} />
          {auditResult.blockers.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {auditResult.blockers.map((b, i) => (
                <Typography
                  key={i}
                  variant="caption"
                  sx={{ display: 'block', color: 'error.main' }}
                >
                  ✕ {b}
                </Typography>
              ))}
            </Box>
          )}
          {auditResult.warnings.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {auditResult.warnings.map((w, i) => (
                <Typography
                  key={i}
                  variant="caption"
                  sx={{ display: 'block', color: 'warning.main' }}
                >
                  ⚠ {w}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}

      {testResult && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <GateChip
              label={`Speed ${testResult.speed.median_ms}ms`}
              status={testResult.speed.status}
            />
            <GateChip
              label={`Size ${Math.round(testResult.size.max_bytes / 1024)}KB`}
              status={testResult.size.status}
            />
            <GateChip label="Shape" status={testResult.shape.status} />
            <GateChip label="Overall" status={testResult.overall} />
          </Stack>
          {testResult.overall !== 'pass' && (
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 1, color: 'text.secondary' }}
            >
              {testResult.shape.details}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default StageGates;
