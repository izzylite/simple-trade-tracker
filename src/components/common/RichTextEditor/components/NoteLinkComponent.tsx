import React from 'react';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ContentState } from 'draft-js';

interface NoteLinkProps {
  contentState: ContentState;
  entityKey: string;
  children: React.ReactNode;
  onNoteLinkClick?: (
    noteId: string,
    noteTitle: string
  ) => void;
}

const NoteLinkComponent: React.FC<NoteLinkProps> = ({
  contentState,
  entityKey,
  children,
  onNoteLinkClick,
}) => {
  const theme = useTheme();
  const { noteId, noteTitle } = contentState
    .getEntity(entityKey)
    .getData();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onNoteLinkClick?.(noteId, noteTitle);
  };

  return (
    <span
      contentEditable={false}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: alpha(
          theme.palette.primary.main,
          0.1
        ),
        color: theme.palette.primary.main,
        border: `1px solid ${alpha(
          theme.palette.primary.main,
          0.25
        )}`,
        borderRadius: 12,
        padding: '1px 8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        lineHeight: 1.6,
        verticalAlign: 'baseline',
        userSelect: 'none',
        cursor: onNoteLinkClick ? 'pointer' : 'default',
        letterSpacing: '0.02em',
        textDecoration: 'none',
        opacity: onNoteLinkClick ? 1 : 0.6,
      }}
      title={
        onNoteLinkClick
          ? `Go to: ${noteTitle || 'Linked note'}`
          : noteTitle || 'Linked note'
      }
    >
      {children}
    </span>
  );
};

export default NoteLinkComponent;
