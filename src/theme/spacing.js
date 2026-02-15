const scale = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64
};

export const spacing = {
  ...scale,
  gridUnit: 8,
  component: {
    screenHorizontal: scale.md,
    screenTop: scale.lg + scale.sm,
    sectionGap: scale.lg,
    cardPadding: scale.sm + scale.xs,
    inputHeight: 46,
    buttonHeight: 46,
    iconButtonMin: 44,
    chipHeight: 34
  }
};
