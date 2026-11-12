import { useEffect, useRef } from 'react';
import { Play, Pause, Square, SkipForward, Rewind, FastForward, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../theme';
import { getBarBeat, getSongDuration, currentIndex, fmtTime } from '../lib/timing';
import { useCurrentSong } from '../hooks/useCurrentSong';
import { useElapsed } from '../hooks/usePlaybackPosition';
import { usePlaybackControls } from '../hooks/usePlaybackControls';

export function ControlView({ songs, playback, sendPlayback }) {
  const { colors: COLORS, isDark } = useTheme();
  const elapsed = useElapsed(playback);
  const { song, lines } = useCurrentSong(songs, playback);
  const { loadSong, togglePlay, stop, nudge, playFrom } = usePlaybackControls(playback, sendPlayback);
  const idx = song ? currentIndex(lines, elapsed) : -1;
  const duration = getSongDuration(lines);
  const { bar: currentBar, beat: currentBeat } = song
    ? getBarBeat(elapsed, song.bpm, song.timeSigNum)
    : { bar: 1, beat: 1 };

  const activeLineRef = useRef(null);

  // Auto-scroll active lyric line into view if it changes
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [idx]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] pb-10" style={{ background: COLORS.panelBg }}>
      <div className="max-w-[1200px] w-full mx-auto p-4 md:px-8 space-y-6">

        {/* Primary Playback Control Bar */}
        <div className="rounded-2xl p-5 shadow-sm space-y-4" style={{ background: COLORS.panelBg2 }}>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">

            {/* Song title and current playback line snippet */}
            <div className="flex-1 min-w-0 w-full lg:w-auto">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: COLORS.inkDim }}>
                  Aktueller Song
                </span>
                {song && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded font-semibold" style={{ background: COLORS.cardBg, color: COLORS.ink }}>
                    {song.bpm} BPM
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold truncate" style={{ color: COLORS.ink }}>
                {song ? song.title : 'Kein Song ausgewählt'}
              </h2>
            </div>

            {/* Main Playback Buttons */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap justify-center">
              <button
                onClick={() => nudge(-5)}
                disabled={!song}
                aria-label="5 Sekunden zurück"
                className="p-2 sm:p-2.5 rounded-full hover:opacity-80 active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center min-w-[2.5rem] sm:min-w-[2.75rem] border"
                style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
                title="5 Sekunden zurück (Schnellvorlauf)"
              >
                <Rewind size={16} className="sm:w-4 sm:h-4" color={COLORS.ink} />
                <span className="text-[9px] font-mono font-bold leading-none -mt-0.5" style={{ color: COLORS.inkDim }}>-5s</span>
              </button>

              <button
                onClick={() => nudge(-1)}
                disabled={!song}
                aria-label="1 Sekunde zurück"
                className="p-2 sm:p-2.5 rounded-full hover:opacity-80 active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center min-w-[2.5rem] sm:min-w-[2.75rem] border"
                style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
                title="1 Sekunde zurück"
              >
                <ChevronLeft size={18} className="sm:w-5 sm:h-5" color={COLORS.ink} />
                <span className="text-[9px] font-mono font-bold leading-none -mt-0.5" style={{ color: COLORS.inkDim }}>-1s</span>
              </button>

              <button
                onClick={togglePlay}
                disabled={!song}
                aria-label={playback.status === 'playing' ? 'Pause und Schwarz' : 'Start'}
                className="p-3.5 sm:p-5 rounded-full shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                style={{ background: COLORS.amber }}
                title={playback.status === 'playing' ? 'Pausieren (Projektion wird schwarz)' : 'Abspielen'}
              >
                {playback.status === 'playing' ? (
                  <Pause size={24} className="sm:w-7 sm:h-7" color="#241a08" />
                ) : (
                  <Play size={24} className="sm:w-7 sm:h-7 translate-x-0.5" color="#241a08" />
                )}
              </button>

              <button
                onClick={() => nudge(1)}
                disabled={!song}
                aria-label="1 Sekunde vor"
                className="p-2 sm:p-2.5 rounded-full hover:opacity-80 active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center min-w-[2.5rem] sm:min-w-[2.75rem] border"
                style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
                title="1 Sekunde vor"
              >
                <ChevronRight size={18} className="sm:w-5 sm:h-5" color={COLORS.ink} />
                <span className="text-[9px] font-mono font-bold leading-none -mt-0.5" style={{ color: COLORS.inkDim }}>+1s</span>
              </button>

              <button
                onClick={() => nudge(5)}
                disabled={!song}
                aria-label="5 Sekunden vor"
                className="p-2 sm:p-2.5 rounded-full hover:opacity-80 active:scale-95 transition disabled:opacity-30 disabled:pointer-events-none flex flex-col items-center justify-center min-w-[2.5rem] sm:min-w-[2.75rem] border"
                style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
                title="5 Sekunden vor (Schnellvorlauf)"
              >
                <FastForward size={16} className="sm:w-4 sm:h-4" color={COLORS.ink} />
                <span className="text-[9px] font-mono font-bold leading-none -mt-0.5" style={{ color: COLORS.inkDim }}>+5s</span>
              </button>

              <button
                onClick={stop}
                disabled={!song}
                className="px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-80 active:scale-95 disabled:opacity-30 disabled:pointer-events-none border"
                style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.inkDim }}
                title="Stoppt die Wiedergabe und schaltet die Projektion schwarz"
              >
                <Square size={13} />
                <span className="hidden sm:inline">Stopp &amp; Schwarz</span>
                <span className="sm:hidden">Stopp</span>
              </button>

              {songs.length > 1 && (
                <button
                  onClick={() => {
                    const currentIdx = songs.findIndex((s) => s.id === playback.songId);
                    if (currentIdx !== -1) {
                      const nextIdx = (currentIdx + 1) % songs.length;
                      loadSong(songs[nextIdx]);
                    }
                  }}
                  className="px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm transition hover:opacity-90 active:scale-95"
                  style={{ background: COLORS.amber, color: '#241a08' }}
                  title="Nächsten Song aus der Liste laden"
                >
                  <span className="hidden sm:inline">Nächster Song</span>
                  <span className="sm:hidden">Weiter</span>
                  <SkipForward size={13} />
                </button>
              )}
            </div>

          </div>

          {/* Current Live Line Preview Banner */}
          {song && (
            <div className="rounded-xl p-4 shadow-inner" style={{ background: isDark ? '#0A0A0D' : COLORS.ink }}>
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-semibold opacity-70" style={{ color: COLORS.line }}>
                  {playback.status === 'playing' ? 'Aktuelle Zeile (Live)' : 'Status'}
                </span>
                <div
                  className="font-mono text-sm sm:text-base font-bold px-3 py-1 rounded-lg shadow-sm flex items-center gap-2"
                  style={{ background: isDark ? '#1C1C22' : COLORS.panelBg, color: COLORS.ink }}
                >
                  <span>{fmtTime(elapsed)} <span className="opacity-40">/</span> {fmtTime(duration)}</span>
                  <span className="opacity-30">·</span>
                  <span>Takt {currentBar}/{currentBeat}</span>
                </div>
              </div>
              <div className="text-lg sm:text-xl font-bold min-h-[1.75rem]" style={{ color: COLORS.stageText }}>
                {idx >= 0 ? lines[idx].en : (playback.status === 'playing' ? '…' : '— Schwarz —')}
              </div>
              {idx >= 0 && lines[idx].de && (
                <div className="text-sm mt-0.5" style={{ color: COLORS.line }}>
                  {lines[idx].de}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2-Column Main Workspace: Left = Song List, Center/Right = Lyrics Lines with scroll */}
        <div className="flex flex-col md:flex-row gap-6 items-start">

          {/* LEFT: Song selection */}
          <div className="w-full md:w-80 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: COLORS.inkDim }}>
                Lieder ({songs.length})
              </span>
            </div>

            <div className="space-y-2 max-h-48 md:max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
              {songs.map((s) => {
                const isSelected = s.id === playback.songId;
                return (
                  <button
                    key={s.id}
                    onClick={() => loadSong(s)}
                    className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center justify-between transition-all border ${
                      isSelected
                        ? 'shadow-md font-bold border-amber-500/50'
                        : 'opacity-85 hover:opacity-100 border-transparent hover:border-black/5 dark:hover:border-white/5'
                    }`}
                    style={{
                      background: isSelected ? COLORS.amber : COLORS.panelBg2,
                      color: isSelected ? '#241a08' : COLORS.ink,
                    }}
                  >
                    <span className="truncate pr-2 font-medium">{s.title}</span>
                    <span className="text-xs font-mono shrink-0 opacity-70">{s.bpm} BPM</span>
                  </button>
                );
              })}
              {songs.length === 0 && (
                <div className="text-sm py-4 text-center rounded-xl p-3" style={{ background: COLORS.panelBg2, color: COLORS.inkDim }}>
                  Keine Songs vorhanden.
                </div>
              )}
            </div>
          </div>

          {/* CENTER: Lyrics Lines with scroll & jump to line */}
          <div className="flex-1 min-w-0 w-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: COLORS.inkDim }}>
                Songzeilen {lines.length > 0 ? `(${lines.length}) – Klick startet ab dieser Zeile` : ''}
              </span>
              {song && (
                <span className="text-xs" style={{ color: COLORS.inkDim }}>
                  {lines.filter(l => !l.stageOnly).length} Projektion / {lines.filter(l => l.stageOnly).length} nur Stage
                </span>
              )}
            </div>

            {!song ? (
              <div className="p-12 text-center rounded-2xl border-2 border-dashed border-black/10" style={{ color: COLORS.inkDim }}>
                Wähle links einen Song aus, um die Zeilen und Steuerung anzuzeigen.
              </div>
            ) : lines.length === 0 ? (
              <div className="p-12 text-center rounded-2xl" style={{ background: COLORS.panelBg2, color: COLORS.inkDim }}>
                Dieser Song hat noch keine Textzeilen. Öffne den Song-Editor, um Text hinzuzufügen.
              </div>
            ) : (
              <div
                className="max-h-[calc(100vh-22rem)] overflow-y-auto rounded-2xl p-2 space-y-1.5 shadow-sm border"
                style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}
              >
                {lines.map((l, i) => {
                  const isActive = i === idx;
                  return (
                    <button
                      key={l.id}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => playFrom(l.t)}
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
                          {l.comment && (
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
                        {l.de && (
                          <div className={`text-xs mt-0.5 opacity-80 ${isActive ? 'font-medium' : ''}`}>
                            {l.de}
                          </div>
                        )}
                      </div>

                      <span
                        className="font-mono text-xs font-semibold px-2 py-0.5 rounded shrink-0 pt-1 opacity-70 whitespace-nowrap self-start"
                        style={{ background: COLORS.line, color: COLORS.ink }}
                        title={`Takt ${l.bar}/${l.beat}`}
                      >
                        Takt {l.bar}/{l.beat}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
