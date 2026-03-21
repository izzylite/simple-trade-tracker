import React from 'react';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ContentState } from 'draft-js';
import { getTagColor } from '../../../../utils/tagColors';

interface TagChipProps {
  contentState: ContentState;
  entityKey: string;
  children: React.ReactNode;
}

/**
 * Inline tag chip component rendered by Draft.js decorator
 * Displays trade tags as styled chips within note content
 */
const TagChipComponent: React.FC<TagChipProps> = ({
  contentState,
  entityKey,
  children,
}) => {
  const theme = useTheme();
  const { tagName } = contentState.getEntity(entityKey).getData();
  const color = getTagColor(tagName);

  return (
    <span
      contentEditable={false}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: alpha(color, 0.15),
        color: color,
        border: `1px solid ${alpha(color, 0.3)}`,
        borderRadius: 12,
        padding: '1px 8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        lineHeight: 1.6,
        verticalAlign: 'baseline',
        userSelect: 'none',
        cursor: 'default',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  );
};

export default TagChipComponent;
