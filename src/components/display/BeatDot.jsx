import { COLORS } from '../../theme';

// Pulsing dot in the bottom right corner, one pulse per beat
// (animation `choir-beat-dot` is defined in GlobalStyles)
export function BeatDot({ bpm }) {
  const pulseDuration = 60 / (bpm || 60);
  return (
    <div className="fixed bottom-6 right-6 w-3 h-3 rounded-full choir-beat-dot" style={{ background: COLORS.amber, animationDuration: `${pulseDuration}s` }} />
  );
}
