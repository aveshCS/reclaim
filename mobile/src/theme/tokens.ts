/**
 * RECLAIM "warm paper" identity: cream paper, deep ink, one sunset-orange accent,
 * a leaf green for growth. Ink on cream is ~15:1; inkSoft on cream ~7:1 (WCAG AA/AAA).
 * Buttons use ink text on orange (~6:1) rather than white (fails contrast).
 */
export const colors = {
  paper: '#FBF4EA',
  card: '#FFFDF8',
  sand: '#F3E6D3',
  ink: '#1F1A17',
  inkSoft: '#5B524B',
  inkFaint: '#8C8279',
  line: '#1F1A17',
  hairline: 'rgba(31,26,23,0.12)',
  orange: '#F26A3D',
  orangeSoft: '#FDE1D3',
  leaf: '#3F8F5B',
  leafSoft: '#DCEFDF',
  butter: '#FFD66B',
  butterSoft: '#FFF1C7',
  sky: '#A9D3EE',
  skySoft: '#E3F1FA',
  blush: '#F5A99A',
  danger: '#C2412D',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

/** Bundled fonts (SIL OFL): Fredoka for headings, Nunito for text. Android needs one family per weight. */
export const fonts = {
  display: 'Fredoka_700Bold',
  heading: 'Fredoka_600SemiBold',
  body: 'Nunito_500Medium',
  bodyBold: 'Nunito_700Bold',
  bodyBlack: 'Nunito_800ExtraBold',
};

export const radius = { sm: 12, md: 18, lg: 24, pill: 999 };

/** Hard "sticker" shadow offset used by cards and buttons. */
export const STICKER_OFFSET = 4;

/** Minimum touch target recommended by Android accessibility guidance (dp). */
export const MIN_TOUCH_TARGET = 48;
