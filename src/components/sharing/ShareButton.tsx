import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
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
  LinkOff as UnshareIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { Trade, Calendar } from '../../types/dualWrite';
import { useAuthState } from '../../contexts/AuthStateContext';
import { logger } from '../../utils/logger';
import {
  deactivateTradeShareLink,
  generateTradeShareLink,
  deactivateCalendarShareLink,
  generateCalendarShareLink
} from '../../services/sharingService';
import { Z_INDEX } from '../../styles/zIndex';

// Generic interface for shareable items
interface ShareableItem {
  id: string;
  shareLink?: string;
  isShared?: boolean;
  shareId?: string;
  sharedAt?: Date;
}

// Trade-specific props
interface ShareTradeProps {
  type: 'trade';
  item: Trade;
  calendarId: string;
  onItemUpdated?: (updatedItem: Trade) => void;
  onUpdateItemProperty?: (itemId: string, updateCallback: (item: Trade) => Trade) => Promise<Trade | undefined>;
  size?: 'small' | 'medium' | 'large';
  color?: 'inherit' | 'primary' | 'secondary' | 'default';
  onMenuClose?: () => void;
}

// Calendar-specific props
interface ShareCalendarProps {
  type: 'calendar';
  item: Calendar;
  onUpdateItemProperty?: (itemId: string, updateCallback: (item: Calendar) => Calendar) => Promise<Calendar | undefined>;
  onMenuClose?: () => void;
  size?: 'small' | 'medium' | 'large';
  color?: 'inherit' | 'primary' | 'secondary' | 'default';
}

type ShareButtonProps = ShareTradeProps | ShareCalendarProps;

const ShareButton: React.FC<ShareButtonProps> = (props) => {
  const { type, item, onUpdateItemProperty } = props;
  const { user } = useAuthState();

  // Trade-specific props
  const calendarId = type === 'trade' ? (props as ShareTradeProps).calendarId : undefined;
  const size = type === 'trade'
    ? ((props as ShareTradeProps).size || 'medium')
    : ((props as ShareCalendarProps).size || 'medium');
  const color = type === 'trade'
    ? ((props as ShareTradeProps).color || 'inherit')
    : ((props as ShareCalendarProps).color || 'inherit');
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string>('');

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation(); // Prevent event from bubbling up to parent components
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleShare = async () => {
    setIsSharing(true);
    handleClose();

    try {
      // Check if item already has a share link
      if (item.share_link && item.is_shared) {
        setShareLink(item.share_link);
        setShareDialogOpen(true);
        setIsSharing(false);
        return;
      }

      // For generating new share links, user must be logged in
      if (!user) {
        logger.warn(`User must be logged in to share ${type}s`);
        setIsSharing(false);
        return;
      }

      // Generate share link based on type
      let data: { shareLink: string; shareId: string; directLink: string };
      if (type === 'trade') {
        data = await generateTradeShareLink(calendarId!, item.id);
      } else {
        data = await generateCalendarShareLink(item.id);
      }

      const shareLink = data.directLink || data.shareLink; // Use direct link if available

      // Update the item with sharing information using onUpdateItemProperty if available
      if (onUpdateItemProperty) {
        try {
            await onUpdateItemProperty(item.id, (currentItem: any) => ({
            ...currentItem,
            shareLink: shareLink,
            isShared: true,
            sharedAt: new Date(),
            shareId: data.shareId
          }));

        } catch (error) {
          logger.error(`Error updating ${type} with sharing information:`, error);
          // Still show the share dialog even if the item update fails
        }
      }

      setShareLink(shareLink);
      setShareDialogOpen(true);
    } catch (error) {
      logger.error(`Error sharing ${type}:`, error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareDialogOpen(false);
    } catch (error) {
      logger.error('Error copying to clipboard:', error);
    }
  };

  const handleUnshare = async () => {
    if (!item.share_id) {
      logger.warn(`No active share found for this ${type}`);
      return;
    }

    setIsSharing(true);
    handleClose();

    try {
      // Deactivate share link based on type
      if (type === 'trade') {
        await deactivateTradeShareLink(item.share_id);
      } else {
        await deactivateCalendarShareLink(item.share_id);
      }

      // Update the item to remove sharing information using onUpdateItemProperty if available
      if (onUpdateItemProperty) {
        try {
          await onUpdateItemProperty(item.id, (currentItem: any) => ({
            ...currentItem,
            shareLink: undefined,
            isShared: false,
            shareId: undefined
          }));

        } catch (error) {
          logger.error(`Error updating ${type} to remove sharing information:`, error);
        }
      }

      logger.log(`${type === 'trade' ? 'Trade' : 'Calendar'} sharing stopped`);
    } catch (error) {
      logger.error(`Error unsharing ${type}:`, error);
    } finally {
      setIsSharing(false);
    }
  };

  const isCurrentlyShared = item.is_shared && item.share_link;
  const itemDisplayName = type === 'trade' ? 'trade' : 'calendar';
  const tooltipText = isCurrentlyShared ? "Manage sharing" : `Share ${itemDisplayName}`;

    return (
      <>
        <Tooltip title={tooltipText}>
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
              <CircularProgress size={size === 'small' ? 16 : 20} />
            ) : (
              <ShareIcon fontSize={size === 'small' ? 'small' : 'medium'} />
            )}
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          onClick={(e) => e.stopPropagation()}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          sx={{ zIndex: Z_INDEX.TOOLTIP }}
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
                setShareLink(item.share_link!);
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

        {/* Share Link Dialog for Trade */}
        <Dialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          onClick={(e) => e.stopPropagation()}
          maxWidth="sm"
          fullWidth
          sx={{ zIndex: Z_INDEX.TOOLTIP }}
        >
          <DialogTitle>Share Trade</DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {type === 'trade' ? 'Anyone with this link can view this trade in read-only mode.' : `Share this calendar with others. They'll be able to view your trades in read-only mode.`}
              </Typography>
              <TextField
                fullWidth
                value={shareLink}
                slotProps={{
                  input: {
                    readOnly: true,
                  },
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
      </>
    );
   

  
};

export default ShareButton;
