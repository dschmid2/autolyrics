import { useTheme } from '../../theme';
import { useElapsed } from '../../hooks/usePlaybackPosition';
import { getBarBeat, fmtTime } from '../../lib/timing';

// Running time and bar/beat of the control view. Kept separate so that only
// this small component re-renders 10x per second while playing.
export function PlaybackClock({ playback, song, duration }) {
  const { colors: COLORS, isDark } = useTheme();
  const elapsed = useElapsed(playback);
  const { bar: currentBar, beat: currentBeat } = song
    ? getBarBeat(elapsed, song.bpm, song.timeSigNum)
    : { bar: 1, beat: 1 };

  return (
    <div
      className="font-mono text-sm sm:text-base font-bold px-3 py-1 rounded-lg shadow-sm flex items-center gap-2"
      style={{ background: isDark ? '#1C1C22' : COLORS.panelBg, color: COLORS.ink }}
    >
      <span>{fmtTime(elapsed)} <span className="opacity-40">/</span> {fmtTime(duration)}</span>
      <span className="opacity-30">·</span>
      <span>Takt {currentBar}/{currentBeat}</span>
    </div>
  );
}
