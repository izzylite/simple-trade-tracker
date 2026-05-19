import '@mui/material/styles';
import type { CSSProperties } from 'react';

declare module '@mui/material/styles' {
  interface TypographyVariants {
    /**
     * Numeric readout — P&L, balance, win-rate, counts.
     * Always tabular figures per DESIGN.md "Tabular-Number Rule".
     */
    numeric: CSSProperties;
  }

  interface TypographyVariantsOptions {
    numeric?: CSSProperties;
  }

  interface TypeText {
    /**
     * Demoted prose tone — captions, timestamps, helper hints.
     * Slate-500 dark / slate-400 light per DESIGN.md "fg-tertiary".
     * Use when `text.secondary` is too prominent but the text still
     * needs to be legible (not the same as `text.disabled`).
     */
    tertiary: string;
  }

  interface Palette {
    custom: {
      /** Page backdrop — re-exposed so non-MUI surfaces can match the canvas. */
      pageBackground: string;
      /** Rare nested-surface tone — only for a panel inside an already-papered panel. */
      paperDarker: string;
      /**
       * Rare emphasis line, heavier than `divider` — chart axes, calendar
       * column header, anywhere a hairline needs to read at a glance.
       */
      hairline: string;
      /**
       * Trader Violet tint surfaces. `soft` = the resting tint
       * (12% dark / 10% light); `strong` = the hover step (18% / 16%).
       * Used by the side-nav Create tile, selected dropdown items, etc.
       */
      tintViolet: {
        soft: string;
        strong: string;
      };
      /**
       * Canonical focus rings. `focusRing` is the standard 3 px violet @15%
       * glow used on inputs and buttons. `focusRingStrong` is the @25%
       * variant reserved for surfaces that compete with busy header chrome
       * (calendar selector trigger).
       */
      focusRing: string;
      focusRingStrong: string;
      /**
       * Semantic radius scale from DESIGN.md. Prefer these to magic numbers
       * in `sx`: `borderRadius: theme.palette.custom.radius.lg`.
       *
       * | key  | px  | role                          |
       * |------|-----|-------------------------------|
       * | xs   | 2   | tooltip nub, tiny accents     |
       * | sm   | 4   | chips                         |
       * | md   | 8   | buttons, inputs               |
       * | lg   | 12  | cards, dialogs, menus         |
       * | xl   | 16  | side-nav tile                 |
       * | xxl  | 24  | calendar-lock card            |
       * | pill | 999 | empty-state CTA pill only     |
       */
      radius: {
        xs: number;
        sm: number;
        md: number;
        lg: number;
        xl: number;
        xxl: number;
        pill: number;
      };
      /**
       * Motion easings. `smooth` is the rail's ease-out-quart curve used by
       * side-nav active-press, calendar selector chevron, and any
       * confidence-building micro-interaction.
       */
      easing: {
        smooth: string;
      };
    };
  }

  interface PaletteOptions {
    custom?: {
      pageBackground?: string;
      paperDarker?: string;
      hairline?: string;
      tintViolet?: {
        soft?: string;
        strong?: string;
      };
      focusRing?: string;
      focusRingStrong?: string;
      radius?: {
        xs?: number;
        sm?: number;
        md?: number;
        lg?: number;
        xl?: number;
        xxl?: number;
        pill?: number;
      };
      easing?: {
        smooth?: string;
      };
    };
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    numeric: true;
  }
}
