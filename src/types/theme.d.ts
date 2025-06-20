import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    custom: {
      pageBackground: string;
    };
  }

  interface PaletteOptions {
    custom?: {
      pageBackground?: string;
    };
  }
}
