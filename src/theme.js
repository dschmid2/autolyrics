import { createContext, useContext, useState, useEffect, useCallback } from 'react';

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


function initialTheme() {
  try {
    const saved = localStorage.getItem('autolyrics_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch (e) {}
  return 'light';
}

// Theme state for ThemeContext.Provider: persisted in localStorage and
// mirrored as `dark` class on <html> (Tailwind darkMode: 'class')
export function useThemeState() {
  const [theme, setTheme] = useState(initialTheme);
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('autolyrics_theme', theme);
    } catch (e) {}
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
    colors: THEME_PALETTES[theme] || THEME_PALETTES.light,
  };
}
