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
  primary: '#247A5B',
  onPrimary: '#FFFFFF',
  secondary: '#0F766E',
  onSecondary: '#FFFFFF',
  background: '#F2F5F3',
  surface01: '#FFFFFF',
  surface02: '#E6ECE8',
  surface03: '#D5DFD9',
  textPrimary: '#101A16',
  textSecondary: '#33403A',
  textMuted: '#50615A',
  border: '#C4D1CA',
  success: '#136D4B',
  warning: '#925F0A',
  error: '#B02525',
  info: '#0A5D86',
  online: '#17714D',
  connecting: '#A86508',
  offline: '#5A6A63'
});

const darkTheme = makeTheme({
  mode: 'dark',
  primary: '#28A278',
  onPrimary: '#05150F',
  secondary: '#4FD1C5',
  onSecondary: '#031D1A',
  background: '#0B0F10',
  surface01: '#131A1C',
  surface02: '#1B2427',
  surface03: '#253034',
  textPrimary: '#EFF5F2',
  textSecondary: '#CFDAD4',
  textMuted: '#9BAAA2',
  border: '#324038',
  success: '#57D7A8',
  warning: '#EAB75B',
  error: '#F4A2A2',
  info: '#8AD1F2',
  online: '#57D7A8',
  connecting: '#EAB75B',
  offline: '#95A39B'
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
