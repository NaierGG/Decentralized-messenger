import React, {createContext, useContext, useMemo, useState} from 'react';
import {useColorScheme} from 'react-native';
import {themeColors} from '../theme/colors';
import {typography} from '../theme/typography';
import {spacing} from '../theme/spacing';

const ThemeContext = createContext(null);

const normalizeMode = (mode) => (mode === 'light' ? 'light' : 'dark');

export const ThemeProvider = ({children, initialMode}) => {
  const systemMode = useColorScheme();
  const [userMode, setUserMode] = useState(initialMode || null);
  const activeMode = normalizeMode(userMode || systemMode);

  const value = useMemo(
    () => ({
      mode: activeMode,
      isDark: activeMode === 'dark',
      colors: themeColors[activeMode],
      typography,
      spacing,
      setMode: (nextMode) => setUserMode(normalizeMode(nextMode)),
      useSystemMode: () => setUserMode(null),
      toggleMode: () => setUserMode((prev) => (normalizeMode(prev || systemMode) === 'dark' ? 'light' : 'dark'))
    }),
    [activeMode, systemMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
};
