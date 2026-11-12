import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2, Upload, Music } from 'lucide-react';
import { useTheme } from '../../theme';
import { uid } from '../../lib/ids';
import { parsePlaintextSongLines } from '../../lib/plaintextImport';
import { computeLinesWithTimes, fmtTime, updateLineTimestamp } from '../../lib/timing';
import { WaveformEditor } from './WaveformEditor';

export function SongEditor({ song, onChange, onDelete, playback, sendPlayback }) {
  const { colors: COLORS, isDark } = useTheme();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
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
  const updateLine = (id, patch) => update({ lines: song.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const jumpToLineMarker = (lineId) => {
    if (waveformSeekRef.current) {
      const computed = computedLines.find((cl) => cl.id === lineId);
      if (computed && computed.t !== undefined) {
        waveformSeekRef.current(computed.t);
      }
    }
  };

  const handleBarChange = (lineId, newBarVal) => {
    const lineIndex = song.lines.findIndex((l) => l.id === lineId);
    if (lineIndex === -1) return;
    const currentLine = song.lines[lineIndex];

    if (newBarVal === '' || newBarVal === null || newBarVal === undefined) {
      updateLine(lineId, { bar: '' });
      return;
    }

    const parsedNewBar = parseInt(newBarVal, 10);
    if (isNaN(parsedNewBar)) {
      updateLine(lineId, { bar: newBarVal });
      return;
    }

    const oldBar = currentLine.bar !== undefined && currentLine.bar !== null && currentLine.bar !== ''
      ? Number(currentLine.bar)
      : 1;

    const deltaBar = parsedNewBar - oldBar;
    if (deltaBar === 0) {
      updateLine(lineId, { bar: parsedNewBar });
      return;
    }

    const defaultMode = song.timingMode || 'bar_beat';
    const updatedLines = song.lines.map((l, idx) => {
      if (l.id === lineId) {
        return { ...l, bar: parsedNewBar };
      }
      if (idx > lineIndex) {
        const lMode = l.mode || defaultMode;
        if (lMode === 'bar_beat') {
          const curBar = l.bar !== undefined && l.bar !== null && l.bar !== '' ? Number(l.bar) : 1;
          return { ...l, bar: Math.max(1, curBar + deltaBar) };
        }
      }
      return l;
    });

    update({ lines: updatedLines });
  };

  const currentTimingMode = song.timingMode || 'bar_beat';

  const handleTimingModeChange = (newMode) => {
    if (newMode === currentTimingMode) return;
    const computed = computeLinesWithTimes(song);
    const updatedLines = song.lines.map((l) => {
      const comp = computed.find((c) => c.id === l.id);
      const t = comp ? comp.t : 0;
      const patch = updateLineTimestamp({ ...l, mode: newMode }, t, song, 0);
      return { ...l, mode: newMode, ...patch };
    });
    update({ timingMode: newMode, lines: updatedLines });
  };

  const insertLine = (index) => {
    const defaultMode = song.timingMode || 'bar_beat';
    const lines = [...song.lines];
    let newTimingProps = defaultMode === 'bar_beat' ? { bar: 1, beat: 1 } : { timeSec: 0 };

    if (lines.length > 0 && index >= 0 && index < lines.length) {
      const prevLine = lines[index];
      const prevMode = prevLine.mode || defaultMode;
      if (prevMode === 'bar_beat') {
        const prevBar = prevLine.bar !== undefined && prevLine.bar !== null && prevLine.bar !== '' ? Number(prevLine.bar) : 1;
        newTimingProps = { bar: prevBar, beat: 1 };
      } else if (prevMode === 'sec') {
        const prevSec = prevLine.timeSec !== undefined && prevLine.timeSec !== null ? Number(prevLine.timeSec) : 0;
        newTimingProps = { timeSec: Math.round((prevSec + 2) * 10) / 10 };
      } else if (prevMode === 'beat') {
        const prevBeat = prevLine.beat !== undefined && prevLine.beat !== null ? Number(prevLine.beat) : 1;
        newTimingProps = { beat: prevBeat };
      } else if (prevMode === 'relative') {
        newTimingProps = { relativeSec: 2 };
      } else if (prevMode === 'relative_bar_beat') {
        newTimingProps = { relativeBar: 1, relativeBeat: 0 };
      }
    } else if (lines.length > 0 && index === -1) {
      // inserting before the first line
      const firstLine = lines[0];
      const firstMode = firstLine.mode || defaultMode;
      if (firstMode === 'bar_beat') {
        const firstBar = firstLine.bar !== undefined && firstLine.bar !== null && firstLine.bar !== '' ? Number(firstLine.bar) : 1;
        newTimingProps = { bar: firstBar, beat: 1 };
      }
    }

    const newLine = { id: uid(), en: '', de: '', mode: defaultMode, duration: '', ...newTimingProps };
    const insertIdx = index + 1; // insert after index
    lines.splice(insertIdx, 0, newLine);

    update({ lines });
  };

  const addLine = () => {
    insertLine(song.lines.length - 1);
  };

  const removeLine = (id) => update({ lines: song.lines.filter((l) => l.id !== id) });
  const moveLine = (id, dir) => {
    const idx = song.lines.findIndex((l) => l.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= song.lines.length) return;
    const next = [...song.lines];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    update({ lines: next });
  };

  // Memoized: WaveformEditor depends on its identity (a new array per render caused a render loop)
  const computedLines = useMemo(() => computeLinesWithTimes(song), [song]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('audio', file);
    setUploading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload fehlgeschlagen');
      const data = await res.json();
      update({ audioUrl: data.url, audioName: data.originalName });
    } catch (err) {
      alert('Fehler beim Hochladen der MP3-Datei: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAudio = () => {
    update({ audioUrl: null, audioName: null });
  };

  return (
    <div className="space-y-4">
      {/* Title & Metadata */}
      <div className="flex gap-2 flex-wrap md:flex-nowrap">
        <input
          value={song.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Songtitel"
          className="flex-1 min-w-[150px] px-3 py-2 rounded-lg text-sm font-semibold border"
          style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
        />
        <div className="flex items-center gap-1.5 shrink-0 rounded-lg p-1 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
          <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>BPM</span>
          <input
            type="number"
            value={song.bpm}
            onChange={(e) => update({ bpm: Number(e.target.value) || 1 })}
            placeholder="BPM"
            className="w-16 px-1.5 py-1 rounded text-sm border"
            style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 rounded-lg p-1 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
          <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>Taktart</span>
          <select
            value={`${song.timeSigNum || 4}/${song.timeSigDen || 4}`}
            onChange={(e) => {
              const [num, den] = e.target.value.split('/');
              update({ timeSigNum: Number(num), timeSigDen: Number(den) });
            }}
            className="px-1.5 py-1 rounded text-sm cursor-pointer border"
            style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
          >
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="2/4">2/4</option>
            <option value="6/8">6/8</option>
            <option value="5/4">5/4</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 rounded-lg p-1 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
          <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>Positionierung</span>
          <select
            value={currentTimingMode}
            onChange={(e) => handleTimingModeChange(e.target.value)}
            className="px-1.5 py-1 rounded text-sm cursor-pointer border"
            style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
          >
            <option value="bar_beat">Takt / Schlag</option>
            <option value="sec">Zeitbasis (Sekunden)</option>
          </select>
        </div>
        <button
          onClick={onDelete}
          aria-label="Song löschen"
          className="px-3 py-2 rounded-lg shrink-0"
          style={{ background: COLORS.danger }}
        >
          <Trash2 size={16} color="#fff" />
        </button>
      </div>

      {/* MP3 Audio Upload & Waveform Section */}
      <div className="rounded-xl p-3 space-y-3 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Music size={18} style={{ color: COLORS.ink }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>
              MP3 Audio-Datei
            </span>
            {song.audioName && (
              <span className="text-xs px-2 py-0.5 rounded font-mono truncate max-w-xs border" style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}>
                {song.audioName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/mp3,audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium disabled:opacity-50"
              style={{ background: COLORS.amber, color: '#241a08' }}
            >
              <Upload size={14} /> {uploading ? 'Lädt hoch…' : song.audioUrl ? 'MP3 ersetzen' : 'MP3 hochladen'}
            </button>
            {song.audioUrl && (
              <button
                onClick={removeAudio}
                className="text-xs px-2 py-1.5 rounded-lg text-white font-medium"
                style={{ background: COLORS.danger }}
                title="MP3 löschen"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {song.audioUrl ? (
          <WaveformEditor
            song={song}
            computedLines={computedLines}
            onUpdateSong={update}
            onPlaybackStateChange={setWaveformPlayback}
            seekRef={waveformSeekRef}
            playback={playback}
            sendPlayback={sendPlayback}
          />
        ) : (
          <div className="p-4 text-center border-2 border-dashed rounded-lg text-xs" style={{ borderColor: COLORS.line, color: COLORS.inkDim }}>
            Keine MP3-Datei verknüpft. Lade eine MP3 hoch, um die interaktive Wellenform mit Zeitstempel-Markern zu nutzen.
          </div>
        )}
      </div>

      {/* Lyric Line Textfields Header & Scroll Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.inkDim }}>
            Songzeilen &amp; Marker-Zeitstempel ({song.lines.length})
          </div>
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
              <div
                key={l.id}
                ref={isPlayingActive ? activeLineRowRef : null}
                onClick={() => jumpToLineMarker(l.id)}
                className={`rounded-lg p-2 space-y-1 transition-all border ${
                  isPlayingActive ? 'ring-2 ring-amber-500 shadow-md border-amber-500/50' : ''
                }`}
                style={{
                  background: isPlayingActive ? (isDark ? '#423214' : '#FDE047') : COLORS.panelBg2,
                  borderColor: isPlayingActive ? COLORS.amber : COLORS.line,
                  color: COLORS.ink,
                }}
              >
                <div className="flex gap-2 items-center">
                  <span
                    className={`font-mono text-xs font-bold px-2 py-1 rounded shrink-0 select-none ${
                      isPlayingActive ? 'bg-amber-400 text-black shadow-sm' : ''
                    }`}
                    style={{
                      background: isPlayingActive ? COLORS.amber : COLORS.line,
                      color: isPlayingActive ? '#241a08' : COLORS.ink,
                    }}
                    title={`Marker #${lineNum}`}
                  >
                    #{lineNum}
                  </span>
                  <input
                    value={l.en}
                    onChange={(e) => updateLine(l.id, { en: e.target.value })}
                    placeholder="Englisch / Haupttext"
                    className="flex-1 px-2 py-1 rounded text-sm border"
                    style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                  />
                  <input
                    value={l.comment || ''}
                    onChange={(e) => updateLine(l.id, { comment: e.target.value })}
                    placeholder="[Kommentar / Solo]"
                    className="w-36 px-2 py-1 rounded text-xs border"
                    style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                    title="Kommentar für Solosänger (wird im Stagedisplay links angezeigt)"
                  />
                  <label className="flex items-center gap-1 text-xs font-medium cursor-pointer whitespace-nowrap" style={{ color: COLORS.inkDim }} title="Nur im Stageview anzeigen (*), nie auf der Projektion">
                    <input
                      type="checkbox"
                      checked={!!l.stageOnly}
                      onChange={(e) => updateLine(l.id, { stageOnly: e.target.checked })}
                      className="rounded accent-amber"
                    />
                    <span>Nur Stage (*)</span>
                  </label>
                </div>
                <input
                  value={l.de || ''}
                  onChange={(e) => updateLine(l.id, { de: e.target.value })}
                  placeholder="Deutsch (Übersetzung)"
                  className="w-full px-2 py-1 rounded text-sm border"
                  style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                />
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <select
                    value={l.mode || currentTimingMode}
                    onChange={(e) => updateLine(l.id, { mode: e.target.value })}
                    className="px-1.5 py-1 rounded text-xs border"
                    style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                  >
                    <option value="bar_beat">Takt / Schlag</option>
                    <option value="sec">Absolut (Sekunden)</option>
                    <option value="relative">Relativ (s seit letzter)</option>
                    <option value="beat">Schlag absolut</option>
                    <option value="relative_bar_beat">Relativ (Takt / Schlag)</option>
                  </select>

                  {l.mode === 'sec' && (
                    <div className="flex items-center gap-1">
                      <span style={{ color: COLORS.inkDim }}>s:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={l.timeSec !== undefined && l.timeSec !== null ? l.timeSec : ''}
                        onChange={(e) => updateLine(l.id, { timeSec: e.target.value })}
                        className="w-16 px-1.5 py-1 rounded border"
                        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                      />
                    </div>
                  )}

                  {l.mode === 'relative' && (
                    <div className="flex items-center gap-1">
                      <span style={{ color: COLORS.inkDim }}>+s:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={l.relativeSec !== undefined && l.relativeSec !== null ? l.relativeSec : ''}
                        onChange={(e) => updateLine(l.id, { relativeSec: e.target.value })}
                        className="w-16 px-1.5 py-1 rounded border"
                        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                      />
                    </div>
                  )}

                  {l.mode === 'relative_bar_beat' && (
                    <div className="flex items-center gap-1">
                      <span style={{ color: COLORS.inkDim }}>+Takt:</span>
                      <input
                        type="number"
                        step="1"
                        value={l.relativeBar !== undefined && l.relativeBar !== null ? l.relativeBar : ''}
                        onChange={(e) => updateLine(l.id, { relativeBar: e.target.value })}
                        className="w-12 px-1.5 py-1 rounded border"
                        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                      />
                      <span style={{ color: COLORS.inkDim }}>+Schlag:</span>
                      <input
                        type="number"
                        step="1"
                        value={l.relativeBeat !== undefined && l.relativeBeat !== null ? l.relativeBeat : ''}
                        onChange={(e) => updateLine(l.id, { relativeBeat: e.target.value })}
                        className="w-12 px-1.5 py-1 rounded border"
                        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                      />
                    </div>
                  )}

                  {(l.mode === 'bar_beat' || !l.mode) && (
                    <div className="flex items-center gap-1">
                      <span style={{ color: COLORS.inkDim }}>Takt:</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={l.bar !== undefined && l.bar !== null ? l.bar : 1}
                        onChange={(e) => handleBarChange(l.id, e.target.value)}
                        className="w-12 px-1.5 py-1 rounded border"
                        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                      />
                      <span style={{ color: COLORS.inkDim }}>Schlag:</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max={song.timeSigNum || 4}
                        value={l.beat !== undefined && l.beat !== null ? l.beat : 1}
                        onChange={(e) => updateLine(l.id, { beat: e.target.value })}
                        className="w-12 px-1.5 py-1 rounded border"
                        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                      />
                    </div>
                  )}

                  {l.mode === 'beat' && (
                    <div className="flex items-center gap-1">
                      <span style={{ color: COLORS.inkDim }}>Schlag:</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={l.beat !== undefined && l.beat !== null ? l.beat : 1}
                        onChange={(e) => updateLine(l.id, { beat: e.target.value })}
                        className="w-16 px-1.5 py-1 rounded border"
                        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <span style={{ color: COLORS.inkDim }} title="Anzeigedauer in Sekunden">Dauer (s):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="∞"
                      value={l.duration !== undefined && l.duration !== null ? l.duration : ''}
                      onChange={(e) => updateLine(l.id, { duration: e.target.value })}
                      className="w-14 px-1.5 py-1 rounded border"
                      style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
                    />
                  </div>

                  <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>≈ {fmtTime(t)}</span>

                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => insertLine(idx)}
                      title="Zeile danach einfügen"
                      aria-label="Zeile danach einfügen"
                      className="p-1 rounded hover:opacity-80 border"
                      style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => moveLine(l.id, -1)}
                      aria-label="Zeile nach oben"
                      className="p-1 rounded hover:opacity-80 border"
                      style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveLine(l.id, 1)}
                      aria-label="Zeile nach unten"
                      className="p-1 rounded hover:opacity-80 border"
                      style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => removeLine(l.id)}
                      aria-label="Zeile löschen"
                      className="p-1 rounded hover:opacity-80 border"
                      style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
                    >
                      <Trash2 size={14} color={COLORS.danger} />
                    </button>
                  </div>
                </div>
              </div>
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
