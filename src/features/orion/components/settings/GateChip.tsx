import React from 'react';
import { Chip } from '@mui/material';
import {
  CheckCircle as PassIcon,
  Warning as WarnIcon,
  Cancel as FailIcon,
} from '@mui/icons-material';
import type { GateStatus } from 'features/orion/types/customTool';

const GATE_ICON: Record<GateStatus, React.ReactNode> = {
  pass: <PassIcon fontSize="small" sx={{ color: 'success.main' }} />,
  warn: <WarnIcon fontSize="small" sx={{ color: 'warning.main' }} />,
  fail: <FailIcon fontSize="small" sx={{ color: 'error.main' }} />,
};

interface Props {
  label: string;
  status: GateStatus;
}

const GateChip: React.FC<Props> = ({ label, status }) => (
  <Chip
    size="small"
    icon={GATE_ICON[status] as React.ReactElement}
    label={`${label}: ${status}`}
    variant="outlined"
    sx={{ textTransform: 'capitalize' }}
  />
);

export default GateChip;
