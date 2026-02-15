const WCAG_AA_MIN_NORMAL = 4.5;

const toLinear = (channel) => {
  const value = channel / 255;
  return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
};

const hexToRgb = (hex) => {
  const normalized = String(hex).replace('#', '');
  const full = normalized.length === 3
    ? normalized
        .split('')
        .map((part) => `${part}${part}`)
        .join('')
    : normalized;

  const int = parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
};

const luminance = (hex) => {
  const {r, g, b} = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const contrastRatio = (first, second) => {
  const l1 = luminance(first);
  const l2 = luminance(second);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const makeTheme = (tokens) => ({
  ...tokens,
  'surface-01': tokens.surface01,
  'surface-02': tokens.surface02,
  'text-primary': tokens.textPrimary,
  'text-secondary': tokens.textSecondary
});

const validateThemeContrast = (theme) => {
  const pairs = [
    ['textPrimary', 'surface01'],
    ['textSecondary', 'surface01'],
    ['textPrimary', 'surface02'],
    ['onPrimary', 'primary'],
    ['error', 'surface01'],
    ['success', 'surface01']
  ];

  const results = pairs.map(([fgKey, bgKey]) => {
    const ratio = contrastRatio(theme[fgKey], theme[bgKey]);
    return {
      foreground: fgKey,
      background: bgKey,
      ratio,
      pass: ratio >= WCAG_AA_MIN_NORMAL
    };
  });

  return {
    pass: results.every((item) => item.pass),
    results
  };
};

const lightTheme = makeTheme({
  mode: 'light',
  primary: '#2446D8',
  onPrimary: '#FFFFFF',
  secondary: '#0F766E',
  onSecondary: '#FFFFFF',
  background: '#F3F5FA',
  surface01: '#FFFFFF',
  surface02: '#E8ECF5',
  surface03: '#D8E0F0',
  textPrimary: '#111827',
  textSecondary: '#334155',
  textMuted: '#475569',
  border: '#CBD5E1',
  success: '#166534',
  warning: '#92400E',
  error: '#B91C1C',
  info: '#1D4ED8',
  online: '#15803D',
  connecting: '#B45309',
  offline: '#475569'
});

const darkTheme = makeTheme({
  mode: 'dark',
  primary: '#7C8CFF',
  onPrimary: '#0B1025',
  secondary: '#2DD4BF',
  onSecondary: '#042F2E',
  background: '#090D1A',
  surface01: '#131A2C',
  surface02: '#1C2438',
  surface03: '#26314A',
  textPrimary: '#F8FAFC',
  textSecondary: '#D6E0EE',
  textMuted: '#B7C3D6',
  border: '#3C4B68',
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#FCA5A5',
  info: '#93C5FD',
  online: '#4ADE80',
  connecting: '#FBBF24',
  offline: '#9AA7BC'
});

export const themeColors = {
  light: lightTheme,
  dark: darkTheme
};

export const contrastReport = {
  light: validateThemeContrast(lightTheme),
  dark: validateThemeContrast(darkTheme)
};

if (__DEV__) {
  Object.entries(contrastReport).forEach(([mode, report]) => {
    if (!report.pass) {
      const failedPairs = report.results
        .filter((item) => !item.pass)
        .map((item) => `${item.foreground}/${item.background}:${item.ratio.toFixed(2)}`)
        .join(', ');
      // eslint-disable-next-line no-console
      console.warn(`[Theme] WCAG AA check failed for ${mode}: ${failedPairs}`);
    }
  });
}

export {contrastRatio};
