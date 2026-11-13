import { useTheme } from '../../theme';
import { fmtTime } from '../../lib/timing';

// All lines of the loaded song; clicking one starts playback from there.
// `compact` (phones): scrolls with the page, no translation, cue below the bar badge.
export function LineList({ lines, idx, onPlayFrom, activeRef, containerRef, compact = false }) {
  const { colors: COLORS } = useTheme();
  return (
    <div
      ref={containerRef}
      className={compact
        ? 'rounded-2xl p-1.5 space-y-1.5 shadow-sm border'
        : 'max-h-[calc(100vh-22rem)] overflow-y-auto rounded-2xl p-2 space-y-1.5 shadow-sm border'}
      style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}
    >
      {lines.map((l, i) => {
        const isActive = i === idx;
        return (
          <button
            key={l.id}
            ref={isActive ? activeRef : null}
            onClick={() => onPlayFrom(l.t)}
            className={`w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all border ${
              isActive
                ? 'shadow-md scale-[1.01] border-amber-500/50'
                : 'border-transparent hover:opacity-90'
            }`}
            style={{
              background: isActive ? COLORS.amber : COLORS.cardBg,
              color: isActive ? '#241a08' : COLORS.ink,
            }}
          >
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded shrink-0 pt-1 opacity-70" style={{ background: COLORS.line, color: COLORS.ink }}>
              {fmtTime(l.t)}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-base leading-snug ${isActive ? 'font-bold' : 'font-semibold'}`}>
                  {l.en}
                </span>
                {!compact && l.comment && (
                  <span className="text-xs font-normal px-1.5 py-0.2 rounded opacity-75" style={{ background: COLORS.line, color: COLORS.ink }}>
                    [{l.comment}]
                  </span>
                )}
                {l.stageOnly && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-600 dark:text-red-400">
                    Nur Stage
                  </span>
                )}
              </div>
              {!compact && l.de && (
                <div className={`text-xs mt-0.5 opacity-80 ${isActive ? 'font-medium' : ''}`}>
                  {l.de}
                </div>
              )}
            </div>

            {compact ? (
              <div className="shrink-0 flex flex-col items-end gap-1 max-w-[6.5rem]">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded opacity-70 whitespace-nowrap" style={{ background: COLORS.line, color: COLORS.ink }}>
                  Takt {l.bar}/{l.beat}
                </span>
                {l.comment && (
                  <span className="text-xs text-right leading-tight break-words opacity-80">
                    {l.comment}
                  </span>
                )}
              </div>
            ) : (
              <span
                className="font-mono text-xs font-semibold px-2 py-0.5 rounded shrink-0 pt-1 opacity-70 whitespace-nowrap self-start"
                style={{ background: COLORS.line, color: COLORS.ink }}
                title={`Takt ${l.bar}/${l.beat}`}
              >
                Takt {l.bar}/{l.beat}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
