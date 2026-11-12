import { createContext, useContext } from 'react';

export const THEME_PALETTES = {
  light: {
    panelBg: '#F4EFE4',
    panelBg2: '#E9E1CE',
    cardBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    ink: '#221F1A',
    inkDim: '#6B6558',
    amber: '#D89A3E',
    line: '#D8CFBB',
    danger: '#B5453A',
    stageBg: '#0A0A0D',
    stageText: '#F4EFE4',
    stageTextDim: '#9AA0AE',
  },
  dark: {
    panelBg: '#121215',
    panelBg2: '#1C1C22',
    cardBg: '#18181F',
    inputBg: '#24242D',
    ink: '#EDEAE4',
    inkDim: '#9AA0AE',
    amber: '#D89A3E',
    line: '#2E2E38',
    danger: '#E05A4C',
    stageBg: '#0A0A0D',
    stageText: '#F4EFE4',
    stageTextDim: '#9AA0AE',
  },
};

export const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
  colors: THEME_PALETTES.light,
});

export function useTheme() {
  return useContext(ThemeContext);
}

// Global fallback for any un-contexted reference
export const COLORS = THEME_PALETTES.light;
