// The "show this once" webhook signing secret panel. Renders a masked
// TextField with reveal toggle + copy button. Copy auto-hides the reveal
// state so the secret doesn't linger on screen after the user grabs it.
//
// Used in create mode only — edit mode keeps the secret in vault and
// rotation is handled by delete + recreate.

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { EYEBROW_SX } from 'styles/designTokens';

interface Props {
  secret: string;
  onCopyError: (message: string) => void;
}

const SecretRevealBox: React.FC<Props> = ({ secret, onCopyError }) => {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = async () => {
    try {
      // navigator.clipboard requires a secure context; on http origins
      // (some preview deploys) or restrictive browsers the call throws.
      await navigator.clipboard.writeText(secret);
    } catch {
      onCopyError(
        'Copy failed — select the secret manually and copy it before closing the dialog.',
      );
      return;
    }
    setCopied(true);
    setRevealed(false);  // auto-hide once it's on the clipboard
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  // Clear pending copy-flash timer on unmount to avoid a state update on
  // an unmounted component.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  return (
    <Box
      sx={{
        p: 1.5,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        backgroundColor: theme.palette.action.hover,
      }}
    >
      <Typography sx={{ ...EYEBROW_SX, color: 'text.tertiary' }}>
        Webhook signing secret
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
        Copy this into your webhook now — it's shown only once. Orion signs every
        POST body with HMAC-SHA256(secret, body) in the{' '}
        <code>X-Orion-Signature</code> header.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          fullWidth
          value={revealed ? secret : '•'.repeat(64)}
          size="small"
          inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
          InputProps={{ readOnly: true }}
        />
        <Tooltip title={revealed ? 'Hide' : 'Reveal'}>
          <IconButton onClick={() => setRevealed((v) => !v)}>
            {revealed
              ? <VisibilityOffIcon fontSize="small" />
              : <VisibilityIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={copied ? 'Copied' : 'Copy'}>
          <IconButton onClick={handleCopy}>
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default SecretRevealBox;
