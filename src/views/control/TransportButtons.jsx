import { Play, Pause, Square, SkipForward, Rewind, FastForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../theme';

const NUDGES = [
  { delta: -5, Icon: Rewind, iconSize: 16, iconClass: 'sm:w-4 sm:h-4', label: '-5s', aria: '5 Sekunden zurück', title: '5 Sekunden zurück (Schnellvorlauf)' },
  { delta: -1, Icon: ChevronLeft, iconSize: 18, iconClass: 'sm:w-5 sm:h-5', label: '-1s', aria: '1 Sekunde zurück', title: '1 Sekunde zurück' },
  { delta: 1, Icon: ChevronRight, iconSize: 18, iconClass: 'sm:w-5 sm:h-5', label: '+1s', aria: '1 Sekunde vor', title: '1 Sekunde vor' },
  { delta: 5, Icon: FastForward, iconSize: 16, iconClass: 'sm:w-4 sm:h-4', label: '+5s', aria: '5 Sekunden vor', title: '5 Sekunden vor (Schnellvorlauf)' },
];

// Nudge, play/pause, stop and next-song buttons.
// `compact` (phones): everything on one row, stop/next as icon-only buttons.
export function TransportButtons({ song, songs, playback, controls, compact = false }) {
  const { colors: COLORS } = useTheme();
  const isPlaying = playback.status === 'playing';
  const nudgeClass = compact
    ? 'p-1.5 rounded-full hover:opacity-80 active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center min-w-[2.25rem] border'
    : 'p-2 sm:p-2.5 rounded-full hover:opacity-80 active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center min-w-[2.5rem] sm:min-w-[2.75rem] border';
  const iconOnlyClass = 'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition hover:opacity-80 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border';

  const loadNext = () => {
    const currentIdx = songs.findIndex((s) => s.id === playback.songId);
    if (currentIdx !== -1) {
      const nextIdx = (currentIdx + 1) % songs.length;
      controls.loadSong(songs[nextIdx]);
    }
  };

  const nudgeButton = ({ delta, Icon, iconSize, iconClass, label, aria, title }) => (
    <button
      key={delta}
      onClick={() => controls.nudge(delta)}
      disabled={!song}
      aria-label={aria}
      className={nudgeClass}
      style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
      title={title}
    >
      <Icon size={iconSize} className={iconClass} color={COLORS.ink} />
      <span className="text-[9px] font-mono font-bold leading-none -mt-0.5" style={{ color: COLORS.inkDim }}>{label}</span>
    </button>
  );

  return (
    <div className={compact ? 'flex items-center justify-between gap-1 w-full flex-nowrap' : 'flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap justify-center'}>
      {NUDGES.slice(0, 2).map(nudgeButton)}

      <button
        onClick={controls.togglePlay}
        disabled={!song}
        aria-label={isPlaying ? 'Pause und Schwarz' : 'Start'}
        className="p-3.5 sm:p-5 rounded-full shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
        style={{ background: COLORS.amber }}
        title={isPlaying ? 'Pausieren (Projektion wird schwarz)' : 'Abspielen'}
      >
        {isPlaying ? (
          <Pause size={24} className="sm:w-7 sm:h-7" color="#241a08" />
        ) : (
          <Play size={24} className="sm:w-7 sm:h-7 translate-x-0.5" color="#241a08" />
        )}
      </button>

      {NUDGES.slice(2).map(nudgeButton)}

      {compact ? (
        <button
          onClick={controls.stop}
          disabled={!song}
          aria-label="Stopp und Schwarz"
          className={iconOnlyClass}
          style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.inkDim }}
          title="Stoppt die Wiedergabe und schaltet die Projektion schwarz"
        >
          <Square size={15} />
        </button>
      ) : (
        <button
          onClick={controls.stop}
          disabled={!song}
          className="px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-80 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border"
          style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.inkDim }}
          title="Stoppt die Wiedergabe und schaltet die Projektion schwarz"
        >
          <Square size={13} />
          <span className="hidden sm:inline">Stopp &amp; Schwarz</span>
          <span className="sm:hidden">Stopp</span>
        </button>
      )}

      {songs.length > 1 && (compact ? (
        <button
          onClick={loadNext}
          aria-label="Nächster Song"
          className={iconOnlyClass}
          style={{ background: COLORS.amber, borderColor: COLORS.amber, color: '#241a08' }}
          title="Nächsten Song aus der Liste laden"
        >
          <SkipForward size={15} />
        </button>
      ) : (
        <button
          onClick={loadNext}
          className="px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm transition hover:opacity-90 active:scale-95"
          style={{ background: COLORS.amber, color: '#241a08' }}
          title="Nächsten Song aus der Liste laden"
        >
          <span className="hidden sm:inline">Nächster Song</span>
          <span className="sm:hidden">Weiter</span>
          <SkipForward size={13} />
        </button>
      ))}
    </div>
  );
}
