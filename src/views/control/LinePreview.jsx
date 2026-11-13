import { useTheme } from '../../theme';
import { PlaybackClock } from './PlaybackClock';

// Dark banner with the line that is currently live, plus the running clock.
// `compact` (phones): song title instead of the label, no translation.
export function LinePreview({ song, lines, idx, playback, duration, compact = false }) {
  const { colors: COLORS, isDark } = useTheme();
  // Secondary text on the dark banner (COLORS.line is dark in dark mode)
  const dimColor = isDark ? COLORS.stageTextDim : COLORS.line;
  const text = idx >= 0 ? lines[idx].en : (playback.status === 'playing' ? '…' : '— Schwarz —');

  if (compact) {
    return (
      <div className="rounded-xl p-3 shadow-inner" style={{ background: isDark ? '#0A0A0D' : COLORS.ink }}>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold truncate min-w-0" style={{ color: dimColor }}>
            {song.title}
          </span>
          <PlaybackClock playback={playback} song={song} duration={duration} compact />
        </div>
        <div className="text-base font-bold leading-snug line-clamp-2 min-h-[1.375rem]" style={{ color: COLORS.stageText }}>
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 shadow-inner" style={{ background: isDark ? '#0A0A0D' : COLORS.ink }}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <span className="text-xs uppercase tracking-wider font-semibold opacity-70" style={{ color: dimColor }}>
          {playback.status === 'playing' ? 'Aktuelle Zeile (Live)' : 'Status'}
        </span>
        <PlaybackClock playback={playback} song={song} duration={duration} />
      </div>
      <div className="text-lg sm:text-xl font-bold min-h-[1.75rem]" style={{ color: COLORS.stageText }}>
        {text}
      </div>
      {idx >= 0 && lines[idx].de && (
        <div className="text-sm mt-0.5" style={{ color: dimColor }}>
          {lines[idx].de}
        </div>
      )}
    </div>
  );
}
