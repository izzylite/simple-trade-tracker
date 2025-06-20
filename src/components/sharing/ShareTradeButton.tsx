import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography
} from '@mui/material';
import {
  Share as ShareIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  LinkOff as UnshareIcon
} from '@mui/icons-material';
import { Trade } from '../../types/trade';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';

interface ShareTradeButtonProps {
  trade: Trade;
  calendarId: string;
  onTradeUpdated?: (updatedTrade: Trade) => void;
  onUpdateTradeProperty?: (tradeId: string, updateCallback: (trade: Trade) => Trade) => Promise<Trade | undefined>;
  size?: 'small' | 'medium' | 'large';
  color?: 'inherit' | 'primary' | 'secondary' | 'default';
}

const ShareTradeButton: React.FC<ShareTradeButtonProps> = ({
  trade,
  calendarId,
  onTradeUpdated,
  onUpdateTradeProperty,
  size = 'medium',
  color = 'inherit'
}) => {
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleShare = async () => {
    if (!user) {
      showSnackbar('You must be logged in to share trades', 'error');
      return;
    }

    setIsSharing(true);
    handleClose();

    try {
      // Check if trade already has a share link
      if (trade.shareLink && trade.isShared) {
        setShareLink(trade.shareLink);
        setShareDialogOpen(true);
        showSnackbar('Using existing share link', 'info');
        setIsSharing(false);
        return;
      }

      const functions = getFunctions();
      const generateShareLink = httpsCallable(functions, 'generateTradeShareLinkV2');

      const result = await generateShareLink({
        calendarId,
        tradeId: trade.id
      });

      const data = result.data as { shareLink: string; shareId: string; directLink: string };
      const shareLink = data.directLink || data.shareLink; // Use direct link if available

      setShareLink(shareLink);
      setShareDialogOpen(true);

      // Update the trade with sharing information using onUpdateTradeProperty if available
      if (onUpdateTradeProperty) {
        try {
          const updatedTrade = await onUpdateTradeProperty(trade.id, (currentTrade) => ({
            ...currentTrade,
            shareLink: shareLink,
            isShared: true,
            sharedAt: new Date(),
            shareId: data.shareId
          }));

          if (updatedTrade && onTradeUpdated) {
            onTradeUpdated(updatedTrade);
          }
        } catch (error) {
          console.error('Error updating trade with sharing information:', error);
          // Still show the share dialog even if the trade update fails
        }
      } else if (onTradeUpdated) {
        // Fallback to local update only
        const updatedTrade: Trade = {
          ...trade,
          shareLink: shareLink,
          isShared: true,
          sharedAt: new Date(),
          shareId: data.shareId
        };
        onTradeUpdated(updatedTrade);
      }

      showSnackbar('Share link generated successfully!', 'success');
    } catch (error) {
      console.error('Error sharing trade:', error);
      showSnackbar('Failed to generate share link', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      showSnackbar('Link copied to clipboard!', 'success');
      setShareDialogOpen(false);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      showSnackbar('Failed to copy link', 'error');
    }
  };

  const handleUnshare = async () => {
    if (!trade.shareId) {
      showSnackbar('No active share found for this trade', 'error');
      return;
    }

    setIsSharing(true);
    handleClose();

    try {
      const functions = getFunctions();
      const deactivateShareFunction = httpsCallable(functions, 'deactivateSharedTradeV2');

      await deactivateShareFunction({ shareId: trade.shareId });

      // Update the trade to remove sharing information using onUpdateTradeProperty if available
      if (onUpdateTradeProperty) {
        try {
          const updatedTrade = await onUpdateTradeProperty(trade.id, (currentTrade) => ({
            ...currentTrade,
            shareLink: undefined,
            isShared: false,
            shareId: undefined
          }));

          if (updatedTrade && onTradeUpdated) {
            onTradeUpdated(updatedTrade);
          }
        } catch (error) {
          console.error('Error updating trade to remove sharing information:', error);
          // Still show success message even if the trade update fails
        }
      } else if (onTradeUpdated) {
        // Fallback to local update only
        const updatedTrade: Trade = {
          ...trade,
          shareLink: undefined,
          isShared: false,
          shareId: undefined
        };
        onTradeUpdated(updatedTrade);
      }

      showSnackbar('Trade sharing stopped', 'success');
    } catch (error) {
      console.error('Error unsharing trade:', error);
      showSnackbar('Failed to stop sharing', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const isCurrentlyShared = trade.isShared && trade.shareLink;

  return (
    <>
      <Tooltip title={isCurrentlyShared ? "Manage sharing" : "Share trade"}>
        <IconButton
          onClick={handleClick}
          size={size}
          color={color}
          disabled={isSharing}
          sx={{
            color: isCurrentlyShared ? 'primary.main' : 'inherit'
          }}
        >
          {isSharing ? (
            <CircularProgress size={20} />
          ) : (
            <ShareIcon />
          )}
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        {!isCurrentlyShared ? (
          <MenuItem onClick={handleShare}>
            <ListItemIcon>
              <LinkIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Generate share link</ListItemText>
          </MenuItem>
        ) : (
          [
            <MenuItem key="copy" onClick={() => {
              setShareLink(trade.shareLink!);
              setShareDialogOpen(true);
              handleClose();
            }}>
              <ListItemIcon>
                <CopyIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Copy share link</ListItemText>
            </MenuItem>,
            <MenuItem key="unshare" onClick={handleUnshare}>
              <ListItemIcon>
                <UnshareIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Stop sharing</ListItemText>
            </MenuItem>
          ]
        )}
      </Menu>

      {/* Share Link Dialog */}
      <Dialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Share Trade</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Anyone with this link can view this trade:
            </Typography>
            <TextField
              fullWidth
              value={shareLink}
              InputProps={{
                readOnly: true,
              }}
              variant="outlined"
              size="small"
              sx={{ mt: 1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>
            Close
          </Button>
          <Button onClick={handleCopyLink} variant="contained" startIcon={<CopyIcon />}>
            Copy Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ShareTradeButton;
