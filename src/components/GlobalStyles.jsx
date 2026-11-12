import { useTheme } from '../theme';

// App-wide CSS that depends on the theme or is shared by several views
export function GlobalStyles() {
  const { colors } = useTheme();
  return (
    <style>{`
        .choir-beat-dot { animation-name: choirBeatPulse; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes choirBeatPulse { 0% { transform: scale(1); opacity: .15; } 15% { transform: scale(1.8); opacity: .55; } 100% { transform: scale(1); opacity: .15; } }
        @media (prefers-reduced-motion: reduce) { .choir-beat-dot { animation: none; opacity: .3; } }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${colors.amber}; outline-offset: 2px; }
      `}</style>
  );
}
