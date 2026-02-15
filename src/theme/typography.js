import {Platform} from 'react-native';

const size = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  hero: 40
};

const weight = {
  regular: '400',
  semibold: '600',
  bold: '700'
};

const lineHeight = {
  tight: 1.4,
  normal: 1.5,
  relaxed: 1.6
};

const baseFontFamily = Platform.select({
  ios: 'SF Pro Text',
  android: 'Roboto',
  default: 'system-ui'
});

const monoFontFamily = Platform.select({
  ios: 'SF Mono',
  android: 'monospace',
  default: 'monospace'
});

const textStyle = (
  fontSize,
  fontWeight = weight.regular,
  lineHeightRatio = lineHeight.normal
) => ({
  fontFamily: baseFontFamily,
  fontSize,
  fontWeight,
  lineHeight: Math.round(fontSize * lineHeightRatio)
});

export const typography = {
  fontFamily: {
    base: baseFontFamily,
    mono: monoFontFamily
  },
  size,
  weight,
  lineHeight,
  textStyle
};
