import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../theme';
import { parsePlaintextSongLines } from '../../lib/plaintextImport';
import { computeLinesWithTimes } from '../../lib/timing';
import { updateLineIn, changeLineTiming, changeTimingMode, insertLineAfter, moveLineBy } from '../../lib/songEdits';
import { ShiftModeToggle } from './ShiftModeToggle';
import { AudioSection } from './AudioSection';
import { LineRow } from './LineRow';
import { SongMetaFields } from './SongMetaFields';

// `shiftMode` ('single' | 'following') applies to dragged markers AND edited
// bar/beat/second fields; it is owned by EditorView so it survives song changes.
export function SongEditor({ song, onChange, onDelete, playback, sendPlayback, shiftMode, onShiftModeChange }) {
  const { colors: COLORS } = useTheme();
  // Reported by WaveformEditor: only what this view needs, so it re-renders on changes only
  const [waveformPlayback, setWaveformPlayback] = useState({ isPlaying: false, activeLineId: null });
  const waveformSeekRef = useRef(null);
  const activeLineRowRef = useRef(null);

  useEffect(() => {
    if (waveformPlayback.isPlaying && activeLineRowRef.current) {
      activeLineRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [waveformPlayback.isPlaying, waveformPlayback.activeLineId]);

  const update = (patch) => onChange({ ...song, ...patch });
  const updateLine = (id, patch) => update({ lines: updateLineIn(song, id, patch) });

  const jumpToLineMarker = (lineId) => {
    if (waveformSeekRef.current) {
      const computed = computedLines.find((cl) => cl.id === lineId);
      if (computed && computed.t !== undefined) {
        waveformSeekRef.current(computed.t);
      }
    }
  };

  const currentTimingMode = song.timingMode || 'bar_beat';

  const handleTimingModeChange = (newMode) => {
    if (newMode === currentTimingMode) return;
    update(changeTimingMode(song, newMode));
  };

  const insertLine = (index) => update({ lines: insertLineAfter(song, index) });

  const addLine = () => {
    insertLine(song.lines.length - 1);
  };

  const removeLine = (id) => update({ lines: song.lines.filter((l) => l.id !== id) });
  const moveLine = (id, dir) => {
    const next = moveLineBy(song, id, dir);
    if (next) update({ lines: next });
  };

  // Memoized: WaveformEditor depends on its identity (a new array per render caused a render loop)
  const computedLines = useMemo(() => computeLinesWithTimes(song), [song]);

  return (
    <div className="space-y-4">
      {/* Title & Metadata */}
      <SongMetaFields song={song} onUpdate={update} onTimingModeChange={handleTimingModeChange} onDelete={onDelete} />

      {/* MP3 Audio Upload & Waveform Section */}
      <AudioSection
        song={song}
        computedLines={computedLines}
        onUpdate={update}
        onPlaybackStateChange={setWaveformPlayback}
        seekRef={waveformSeekRef}
        shiftMode={shiftMode}
        onShiftModeChange={onShiftModeChange}
        playback={playback}
        sendPlayback={sendPlayback}
      />

      {/* Lyric Line Textfields Header & Scroll Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-bold uppercase tracking-wide mr-auto" style={{ color: COLORS.inkDim }}>
            Songzeilen &amp; Marker-Zeitstempel ({song.lines.length})
          </div>
          {song.lines.length > 1 && (
            <ShiftModeToggle mode={shiftMode} onChange={onShiftModeChange} />
          )}
          {song.lines.length > 0 && (
            <button
              onClick={() => insertLine(-1)}
              title="Zeile ganz oben einfügen"
              className="text-xs px-2 py-0.5 rounded flex items-center gap-1 font-medium border"
              style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}
            >
              <Plus size={12} /> Am Anfang einfügen
            </button>
          )}
        </div>

        <div className="max-h-[calc(100vh-28rem)] min-h-[160px] overflow-y-auto space-y-2 pr-1 rounded-xl">
          {song.lines.map((l, idx) => {
            const computedIdx = computedLines.findIndex((cl) => cl.id === l.id);
            const computedLine = computedIdx >= 0 ? computedLines[computedIdx] : null;
            const t = computedLine ? computedLine.t : 0;
            const lineNum = computedIdx >= 0 ? computedIdx + 1 : idx + 1;
            const isPlayingActive = waveformPlayback.isPlaying && waveformPlayback.activeLineId === l.id;
            return (
              <LineRow
                key={l.id}
                line={l}
                lineNum={lineNum}
                t={t}
                timingMode={currentTimingMode}
                timeSigNum={song.timeSigNum}
                isPlayingActive={isPlayingActive}
                rowRef={isPlayingActive ? activeLineRowRef : null}
                onJump={() => jumpToLineMarker(l.id)}
                onChange={(patch) => updateLine(l.id, patch)}
                onTimingChange={(patch) => update({ lines: changeLineTiming(song, l.id, patch, shiftMode) })}
                onInsertAfter={() => insertLine(idx)}
                onMove={(dir) => moveLine(l.id, dir)}
                onRemove={() => removeLine(l.id)}
              />
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={addLine} className="flex-1 text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1" style={{ background: COLORS.amber, color: '#241a08' }}>
          <Plus size={14} /> Zeile hinzufügen
        </button>
        <button
          onClick={() => {
            const txt = prompt('Klartext hier einfügen (jede Zeile = 1 Takt, * = nur Stage, [xxx] = Solo-Kommentar):');
            if (txt) {
              const parsed = parsePlaintextSongLines(txt);
              if (parsed.length) update({ lines: parsed });
            }
          }}
          className="text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1"
          style={{ background: COLORS.panelBg2, color: COLORS.ink }}
          title="Klartext als Songzeilen importieren"
        >
          Klartext in Song importieren
        </button>
      </div>
    </div>
  );
}
