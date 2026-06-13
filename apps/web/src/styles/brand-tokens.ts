/** Yıldız Holding marka token'ları — kaynak: yildizholding.com.tr CSS audit */
export const brandColors = {
  red: {
    primary: '#EB1C2E',
    light: '#F44350',
    dark: '#C41928',
    hover: '#EE3E4D',
    focusRing: 'rgba(235, 28, 46, 0.35)',
    wash: '#FBF5F6',
  },
  black: '#000000',
  white: '#FFFFFF',
  gray: {
    50: '#F8F8F8',
    100: '#F3F1F2',
    200: '#E3E3E3',
    400: '#636466',
    500: '#6C757D',
    900: '#0D1B2E',
  },
} as const;

export const brandTypography = {
  fontFamily: [
    'Poppins',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ].join(','),
  fontFamilyMono: '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const brandShape = {
  /** Standart buton — site `.btn { border-radius: 0 }` */
  radiusButton: 0,
  /** Kart, input — hafif yuvarlak (operasyon UI okunabilirliği) */
  radiusSm: 8,
  radiusMd: 12,
  /** Yalnızca `.btn-circle` — MVP dışı dekoratif varyant */
  radiusPill: 9999,
} as const;

export const brandSpacing = {
  pageY: 48,
  sectionY: 40,
  containerPx: 20,
} as const;

export const brandEffects = {
  headerShadow: '0 0 5px rgba(0, 0, 0, 0.12)',
  focusRing: `0 0 0 4px ${brandColors.red.focusRing}`,
  transitionFast: '0.15s ease-in-out',
  transitionMedium: '0.2s ease-in-out',
} as const;
