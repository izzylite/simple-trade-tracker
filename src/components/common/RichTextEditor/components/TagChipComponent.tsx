import React from 'react';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import LocalOfferIcon from '@mui/icons-material/LocalOfferOutlined';
import { ContentState } from 'draft-js';
import { getTagColor, isGroupedTag, getTagGroup, getTagName } from '../../../../utils/tagColors';

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
}) => {
  const theme = useTheme();
  const { tagName } = contentState
    .getEntity(entityKey).getData();
  const color = getTagColor(tagName);
  const grouped = isGroupedTag(tagName);
  const groupName = grouped ? getTagGroup(tagName) : '';
  const displayName = grouped
    ? getTagName(tagName) : tagName;

  return (
    <span
      contentEditable={false}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        backgroundColor: alpha(color, 0.12),
        color: color,
        border: `1px solid ${alpha(color, 0.25)}`,
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
      <LocalOfferIcon
        style={{ fontSize: '0.8rem', flexShrink: 0 }}
      />
      {grouped && (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 800,
          }}
        >
          {groupName}
        </span>
      )}
      <span>{displayName}</span>
    </span>
  );
};

export default TagChipComponent;
