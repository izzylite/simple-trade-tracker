import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Chip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { ManageSearch as ManageSearchIcon } from '@mui/icons-material';
import BaseDialog from 'components/common/BaseDialog';
import type {
  AlertFrequency,
  AlertMinSignificance,
  MarketResearchConfig,
  OrionTask,
} from 'features/orion/types/orionTask';
import {
  ASSET_CLASSES,
  instrumentsForClasses,
} from 'features/events/services/instrumentCatalog';
import { formatFrequencyLabel } from 'features/orion/components/orionTasks/marketResearchHelpers';
import { useDialogTokens, MONO_FONT } from 'styles/dialogTokens';

interface MarketResearchSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  existingTask: OrionTask | null;
  onSave: (config: MarketResearchConfig) => Promise<void>;
}

const FREQUENCY_OPTIONS: Array<{ value: AlertFrequency; label: string }> = [
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
  { value: 240, label: '4h' },
  { value: 360, label: '6h' },
  { value: 1440, label: '24h' },
];

const SIGNIFICANCE_OPTIONS: Array<{ value: AlertMinSignificance; label: string }> = [
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const DEFAULT_CONFIG: MarketResearchConfig = {
  frequency_minutes: 60,
  min_significance: 'high',
  subscribed_assets: [],
};

function hydrateConfig(existingTask: OrionTask | null): MarketResearchConfig {
  if (!existingTask) return { ...DEFAULT_CONFIG };
  const raw = existingTask.config as unknown as Record<string, unknown>;
  const rawFreq = raw.frequency_minutes as number | undefined;
  const supported = new Set([60, 120, 180, 240, 360, 1440]);
  return {
    frequency_minutes: supported.has(rawFreq ?? 0) ? (rawFreq as AlertFrequency) : 60,
    min_significance: (raw.min_significance as AlertMinSignificance) ?? 'high',
    subscribed_assets: Array.isArray(raw.subscribed_assets)
      ? (raw.subscribed_assets as string[])
      : [],
  };
}

const FieldGroup: React.FC<{ label: string; helper?: string; children: React.ReactNode }> = ({
  label, helper, children,
}) => {
  const { monoLabelSx } = useDialogTokens();
  return (
    <Box>
      <Typography sx={{ ...monoLabelSx, mb: 0.75 }}>{label}</Typography>
      {children}
      {helper && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}>
          {helper}
        </Typography>
      )}
    </Box>
  );
};

const MarketResearchSettingsDialog: React.FC<MarketResearchSettingsDialogProps> = ({
  open, onClose, existingTask, onSave,
}) => {
  const theme = useTheme();
  const { violet, violetSoft, violetBorder, chipStyle } = useDialogTokens();
  const isEditMode = existingTask !== null;

  const [config, setConfig] = useState<MarketResearchConfig>(() => hydrateConfig(existingTask));
  const [saving, setSaving] = useState(false);

  const wasOpen = useRef(open);
  useEffect(() => {
    const isOpenEdge = open && !wasOpen.current;
    wasOpen.current = open;
    if (isOpenEdge) setConfig(hydrateConfig(existingTask));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSave = config.subscribed_assets.length > 0;

  const segChipSx = (selected: boolean) => ({
    ...chipStyle(selected),
    border: 'none',
    '&:focus-visible': { outline: `2px solid ${violet}`, outlineOffset: 2 },
  });

  const toggleAsset = (symbol: string) => {
    const next = config.subscribed_assets.includes(symbol)
      ? config.subscribed_assets.filter((s) => s !== symbol)
      : [...config.subscribed_assets, symbol];
    setConfig((prev) => ({ ...prev, subscribed_assets: next }));
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try { await onSave(config); onClose(); } finally { setSaving(false); }
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      title={isEditMode ? 'Edit Market Research' : 'Set Up Market Research'}
      headerIcon={<ManageSearchIcon sx={{ fontSize: 20 }} />}
      primaryButtonText={isEditMode ? 'Save' : 'Set Up'}
      primaryButtonAction={handleSave}
      isSubmitting={saving}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* Asset selection */}
        <FieldGroup
          label="Assets to watch"
          helper={config.subscribed_assets.length === 0
            ? 'Pick at least one asset.'
            : `${config.subscribed_assets.length} asset${config.subscribed_assets.length !== 1 ? 's' : ''} selected`}
        >
          {ASSET_CLASSES.map((assetClass) => {
            const symbols = instrumentsForClasses([assetClass]);
            return (
              <Box key={assetClass} sx={{ mb: 1.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    mb: 0.5,
                    display: 'block',
                    fontFamily: MONO_FONT,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontSize: '0.68rem',
                  }}
                >
                  {assetClass}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {symbols.map((symbol) => {
                    const selected = config.subscribed_assets.includes(symbol);
                    return (
                      <Chip
                        key={symbol}
                        label={symbol}
                        size="small"
                        onClick={() => toggleAsset(symbol)}
                        sx={{
                          height: 24,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          fontFamily: MONO_FONT,
                          cursor: 'pointer',
                          backgroundColor: selected
                            ? violetSoft
                            : alpha(theme.palette.background.paper, 0.6),
                          color: selected ? violet : 'text.secondary',
                          border: `1px solid ${selected ? violetBorder : theme.palette.divider}`,
                          '&:hover': {
                            backgroundColor: selected ? violetSoft : alpha(violet, 0.06),
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </FieldGroup>

        {/* Frequency */}
        <FieldGroup
          label="Frequency"
          helper={`New briefings surface every ${formatFrequencyLabel(config.frequency_minutes)}`}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <Box
                key={opt.value}
                component="button"
                onClick={() => setConfig((prev) => ({ ...prev, frequency_minutes: opt.value }))}
                sx={segChipSx(config.frequency_minutes === opt.value)}
              >
                {opt.label}
              </Box>
            ))}
          </Box>
        </FieldGroup>

        {/* Significance */}
        <FieldGroup
          label="Minimum significance"
          helper="Only catalysts at or above this level trigger a briefing."
        >
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {SIGNIFICANCE_OPTIONS.map((opt) => (
              <Box
                key={opt.value}
                component="button"
                onClick={() => setConfig((prev) => ({ ...prev, min_significance: opt.value }))}
                sx={segChipSx(config.min_significance === opt.value)}
              >
                {opt.label}
              </Box>
            ))}
          </Box>
        </FieldGroup>

      </Box>
    </BaseDialog>
  );
};

export default MarketResearchSettingsDialog;
