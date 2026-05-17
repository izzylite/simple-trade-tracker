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
  Button,
  TextField,
  Box,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Share as ShareIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  LinkOff as UnshareIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { dialogProps } from '../../styles/dialogStyles';
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
  const theme = useTheme();

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

        {/* Share Link Dialog */}
        {(() => {
          const isDarkSb = theme.palette.mode === 'dark';
          const violet = theme.palette.primary.main;
          const violetSoft = alpha(violet, isDarkSb ? 0.18 : 0.14);
          const violetBorder = alpha(violet, isDarkSb ? 0.35 : 0.28);
          const surfaceInset = isDarkSb
            ? 'rgba(255,255,255,0.03)'
            : alpha(theme.palette.text.primary, 0.03);
          const hairline = isDarkSb ? 'rgba(255,255,255,0.08)' : theme.palette.divider;
          const MONO_FONT_SB = "'JetBrains Mono', ui-monospace, monospace";
          const monoLabelSx = {
            fontFamily: MONO_FONT_SB,
            fontSize: '0.68rem',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: theme.palette.text.secondary,
          };
          const titleText = type === 'trade' ? 'Share trade' : 'Share calendar';
          const subtitleText = type === 'trade'
            ? 'Anyone with this link can view the trade in read-only mode'
            : "Anyone with this link can view your calendar's trades in read-only mode";

          return (
            <Dialog
              open={shareDialogOpen}
              onClose={() => setShareDialogOpen(false)}
              onClick={(e) => e.stopPropagation()}
              maxWidth="sm"
              fullWidth
              {...dialogProps}
              sx={{ zIndex: Z_INDEX.TOOLTIP }}
              slotProps={{
                paper: {
                  sx: {
                    borderRadius: 2,
                    border: `1px solid ${hairline}`,
                    boxShadow: theme.shadows[10],
                    backgroundImage: 'none',
                    overflow: 'hidden',
                  },
                },
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2.5,
                  py: 1.75,
                  borderBottom: `1px solid ${hairline}`,
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: violetSoft,
                    color: violet,
                    border: `1px solid ${violetBorder}`,
                    flexShrink: 0,
                  }}
                >
                  <LinkIcon sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
                    {titleText}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.78rem',
                      color: theme.palette.text.secondary,
                      lineHeight: 1.3,
                    }}
                  >
                    {subtitleText}
                  </Typography>
                </Box>
                <IconButton
                  onClick={() => setShareDialogOpen(false)}
                  size="small"
                  sx={{ color: theme.palette.text.secondary }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Body */}
              <Box
                sx={{
                  px: 2.5,
                  py: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                }}
              >
                <Typography sx={monoLabelSx}>Share URL</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={shareLink}
                  slotProps={{
                    input: {
                      readOnly: true,
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                      backgroundColor: surfaceInset,
                      '& fieldset': { borderColor: hairline },
                      '&:hover fieldset': { borderColor: alpha(violet, 0.5) },
                      '&.Mui-focused fieldset': { borderColor: violet, borderWidth: 1 },
                    },
                    '& .MuiOutlinedInput-input': {
                      py: 1.1,
                      fontSize: '0.82rem',
                      fontFamily: MONO_FONT_SB,
                    },
                  }}
                />
              </Box>

              {/* Footer */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 1,
                  px: 2.5,
                  py: 1.5,
                  borderTop: `1px solid ${hairline}`,
                  backgroundColor: isDarkSb
                    ? 'rgba(255,255,255,0.02)'
                    : alpha(theme.palette.text.primary, 0.02),
                }}
              >
                <Button
                  onClick={() => setShareDialogOpen(false)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: theme.palette.text.secondary,
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.text.primary, 0.04),
                    },
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={handleCopyLink}
                  variant="contained"
                  startIcon={<CopyIcon sx={{ fontSize: 16 }} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    backgroundColor: violet,
                    color: '#fff',
                    borderRadius: 1.25,
                    px: 1.75,
                    py: 0.75,
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                      boxShadow: 'none',
                    },
                  }}
                >
                  Copy link
                </Button>
              </Box>
            </Dialog>
          );
        })()}
      </>
    );
   

  
};

export default ShareButton;
