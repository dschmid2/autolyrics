import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../theme';
import { getSongDuration } from '../lib/timing';
import { useCurrentSong } from '../hooks/useCurrentSong';
import { useIsPhone } from '../hooks/useMediaQuery';
import { useLineIndex } from '../hooks/usePlaybackPosition';
import { usePlaybackControls } from '../hooks/usePlaybackControls';
import { LineList } from './control/LineList';
import { LinePreview } from './control/LinePreview';
import { SongList } from './control/SongList';
import { TransportButtons } from './control/TransportButtons';

// Operator screen. Phones get their own arrangement (PhoneLayout): collapsible
// song picker on top, transport + live line pinned below the menu bar, and the
// lines scrolling with the page.
export function ControlView({ songs, playback, sendPlayback }) {
  const { song, lines } = useCurrentSong(songs, playback);
  const controls = usePlaybackControls(playback, sendPlayback);
  // Re-renders only when the active line changes; the running time is in PlaybackClock
  const idx = useLineIndex(lines, playback, 0);
  const isPhone = useIsPhone();
  const activeLineRef = useRef(null);
  const pinnedRef = useRef(null);

  // Auto-scroll active lyric line into view if it changes
  useEffect(() => {
    const el = activeLineRef.current;
    if (!el) return;
    if (!isPhone) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    // Phones: the page scrolls and the pinned header covers the top. Only
    // scroll if the line is outside the free area below it, then center it there.
    const top = pinnedRef.current ? pinnedRef.current.getBoundingClientRect().bottom : 0;
    const bottom = window.innerHeight;
    const rect = el.getBoundingClientRect();
    if (rect.top < top + 4 || rect.bottom > bottom - 4) {
      const target = top + (bottom - top) / 2 - rect.height / 2;
      window.scrollBy({ top: rect.top - target, behavior: 'smooth' });
    }
  }, [idx, isPhone]);

  // Another song was loaded (by the operator or automatically): show its start
  const lineListRef = useRef(null);
  const songId = song ? song.id : null;
  const lastSongIdRef = useRef(songId);
  useEffect(() => {
    if (lastSongIdRef.current === songId) return;
    const hadSong = lastSongIdRef.current !== null;
    lastSongIdRef.current = songId;
    if (!hadSong) return; // first load of the page: keep the active line in view
    if (isPhone) window.scrollTo({ top: 0 });
    else if (lineListRef.current) lineListRef.current.scrollTop = 0;
  }, [songId, isPhone]);

  const shared = {
    songs, playback, song, lines, idx, controls, activeLineRef, pinnedRef, lineListRef,
    duration: getSongDuration(lines),
  };
  return isPhone ? <PhoneLayout {...shared} /> : <WideLayout {...shared} />;
}

function LinesHint({ song, lines }) {
  const { colors: COLORS } = useTheme();
  if (!song) {
    return (
      <div className="p-12 text-center rounded-2xl border-2 border-dashed border-black/10" style={{ color: COLORS.inkDim }}>
        Wähle links einen Song aus, um die Zeilen und Steuerung anzuzeigen.
      </div>
    );
  }
  if (lines.length === 0) {
    return (
      <div className="p-12 text-center rounded-2xl" style={{ background: COLORS.panelBg2, color: COLORS.inkDim }}>
        Dieser Song hat noch keine Textzeilen. Öffne den Song-Editor, um Text hinzuzufügen.
      </div>
    );
  }
  return null;
}

function WideLayout({ songs, playback, song, lines, idx, controls, activeLineRef, lineListRef, duration }) {
  const { colors: COLORS } = useTheme();
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

            <TransportButtons song={song} songs={songs} playback={playback} controls={controls} />

          </div>

          {song && (
            <LinePreview song={song} lines={lines} idx={idx} playback={playback} duration={duration} />
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

            <SongList
              songs={songs}
              selectedId={playback.songId}
              onSelect={controls.loadSong}
              className="space-y-2 max-h-48 md:max-h-[calc(100vh-22rem)] overflow-y-auto pr-1"
            />
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

            {(!song || lines.length === 0) ? (
              <LinesHint song={song} lines={lines} />
            ) : (
              <LineList lines={lines} idx={idx} onPlayFrom={controls.playFrom} activeRef={activeLineRef} containerRef={lineListRef} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function PhoneLayout({ songs, playback, song, lines, idx, controls, activeLineRef, pinnedRef, duration }) {
  const { colors: COLORS } = useTheme();
  // null = automatic: open only while no song is loaded (the songs arrive after
  // the first render). Tapping the header or picking a song sets it explicitly.
  const [pickerChoice, setPickerChoice] = useState(null);
  const pickerOpen = pickerChoice !== null ? pickerChoice : !song;
  const selectSong = (s) => {
    controls.loadSong(s);
    setPickerChoice(false);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] pb-10" style={{ background: COLORS.panelBg }}>
      <div className="p-3">

        {/* Collapsible song picker */}
        <div className="rounded-xl mb-2" style={{ background: COLORS.panelBg2 }}>
          <button
            type="button"
            onClick={() => setPickerChoice(!pickerOpen)}
            aria-expanded={pickerOpen}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
          >
            <span className="min-w-0 flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-wider font-bold shrink-0" style={{ color: COLORS.inkDim }}>
                Lieder ({songs.length})
              </span>
              <span className="text-sm font-semibold truncate" style={{ color: COLORS.ink }}>
                {song ? song.title : 'Kein Song ausgewählt'}
              </span>
            </span>
            {pickerOpen
              ? <ChevronUp size={18} className="shrink-0" color={COLORS.ink} />
              : <ChevronDown size={18} className="shrink-0" color={COLORS.ink} />}
          </button>
          {pickerOpen && (
            <SongList
              songs={songs}
              selectedId={playback.songId}
              onSelect={selectSong}
              className="space-y-1.5 max-h-[50vh] overflow-y-auto px-2 pb-2"
            />
          )}
        </div>

        {/* Pinned below the menu bar (h-14): transport and the live line */}
        <div
          ref={pinnedRef}
          className="sticky top-14 z-30 -mx-3 px-3 py-2 space-y-2 border-b shadow-sm"
          style={{ background: COLORS.panelBg, borderColor: COLORS.line }}
        >
          <TransportButtons song={song} songs={songs} playback={playback} controls={controls} compact />
          {song && (
            <LinePreview song={song} lines={lines} idx={idx} playback={playback} duration={duration} compact />
          )}
        </div>

        {/* Lines scroll with the page */}
        <div className="pt-3 space-y-2">
          {song && lines.length > 0 && (
            <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color: COLORS.inkDim }}>
              Songzeilen ({lines.length}) – Tippen startet ab der Zeile
            </div>
          )}
          {(!song || lines.length === 0) ? (
            <LinesHint song={song} lines={lines} />
          ) : (
            <LineList lines={lines} idx={idx} onPlayFrom={controls.playFrom} activeRef={activeLineRef} compact />
          )}
        </div>

      </div>
    </div>
  );
}
