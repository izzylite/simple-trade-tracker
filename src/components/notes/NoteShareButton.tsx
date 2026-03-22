import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Note } from '../../types/note';
import {
  generateNoteShareLink,
  deactivateNoteShareLink,
} from '../../services/sharingService';

interface NoteShareButtonProps {
  note: Note;
  onNoteUpdate: (updates: Partial<Note>) => void;
  onSnackbar: (message: string) => void;
}

const NoteShareButton: React.FC<NoteShareButtonProps> = ({
  note,
  onNoteUpdate,
  onSnackbar,
}) => {
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(
    null
  );

  const isShared = note.is_shared && note.share_link;

  const handleShare = async () => {
    setLoading(true);
    try {
      const result = await generateNoteShareLink(note.id);
      await navigator.clipboard.writeText(result.shareLink);
      onNoteUpdate({
        share_id: result.shareId,
        share_link: result.shareLink,
        is_shared: true,
        shared_at: new Date(),
      });
      onSnackbar('Share link copied to clipboard');
    } catch (error) {
      onSnackbar('Failed to generate share link');
    } finally {
      setLoading(false);
      setAnchorEl(null);
    }
  };

  const handleCopyLink = async () => {
    if (note.share_link) {
      await navigator.clipboard.writeText(note.share_link);
      onSnackbar('Share link copied to clipboard');
    }
    setAnchorEl(null);
  };

  const handleDeactivate = async () => {
    if (!note.share_id) return;
    setLoading(true);
    try {
      await deactivateNoteShareLink(note.share_id);
      onNoteUpdate({
        share_id: null,
        share_link: null,
        is_shared: false,
        shared_at: null,
      });
      onSnackbar('Share link deactivated');
    } catch (error) {
      onSnackbar('Failed to deactivate share link');
    } finally {
      setLoading(false);
      setAnchorEl(null);
    }
  };

  if (loading) {
    return (
      <IconButton size="small" disabled>
        <CircularProgress size={18} />
      </IconButton>
    );
  }

  if (!isShared) {
    return (
      <Tooltip title="Share note">
        <IconButton size="small" onClick={handleShare}>
          <ShareIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title="Sharing active">
        <IconButton
          size="small"
          color="primary"
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <LinkIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={handleCopyLink}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy link</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeactivate}>
          <ListItemIcon>
            <LinkOffIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Stop sharing</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default NoteShareButton;
