import React from 'react';
import { useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import EventIcon from '@mui/icons-material/EventOutlined';
import { ContentState } from 'draft-js';
import {
  IMPACT_COLORS,
  CURRENCY_FLAGS,
} from '../../../../types/economicCalendar';
import type {
  ImpactLevel,
  Currency,
} from '../../../../types/economicCalendar';

interface EventLinkProps {
  contentState: ContentState;
  entityKey: string;
  children: React.ReactNode;
  onEventLinkClick?: (
    eventId: string,
    eventName: string,
    currency: Currency,
    impact: ImpactLevel
  ) => void;
}

const EventLinkComponent: React.FC<EventLinkProps> = ({
  contentState,
  entityKey,
  children,
  onEventLinkClick,
}) => {
  const theme = useTheme();
  const { eventId, eventName, currency, impact } =
    contentState.getEntity(entityKey).getData();

  const impactColor =
    IMPACT_COLORS[impact as ImpactLevel] ||
    theme.palette.text.secondary;
  const flag = CURRENCY_FLAGS[currency as Currency] || '';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onEventLinkClick?.(eventId, eventName, currency, impact);
  };

  return (
    <span
      contentEditable={false}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        backgroundColor: alpha(impactColor, 0.1),
        color: impactColor,
        border: `1px solid ${alpha(impactColor, 0.25)}`,
        borderRadius: 12,
        padding: '1px 8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        lineHeight: 1.6,
        verticalAlign: 'baseline',
        userSelect: 'none',
        cursor: onEventLinkClick ? 'pointer' : 'default',
        letterSpacing: '0.02em',
        textDecoration: 'none',
        opacity: onEventLinkClick ? 1 : 0.6,
      }}
      title={
        onEventLinkClick
          ? `View event: ${eventName || 'Economic event'}`
          : eventName || 'Economic event'
      }
    >
      <EventIcon
        sx={{ fontSize: '0.85rem', flexShrink: 0 }}
      />
      {currency && (
        <span style={{
          fontWeight: 800,
          fontSize: '0.7rem',
          letterSpacing: '0.03em',
        }}>
          {currency}
        </span>
      )}
      {children}
    </span>
  );
};

export default EventLinkComponent;
