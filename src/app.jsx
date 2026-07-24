import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Plus, Trash2, ChevronUp, ChevronDown, Maximize2, X, Settings2, Copy, Check, WifiOff } from 'lucide-react';

const COLORS = {
  stageBg: '#0A0A0D',
  stageText: '#F4EFE4',
  stageTextDim: '#9AA0AE',
  panelBg: '#F4EFE4',
  panelBg2: '#E9E1CE',
  ink: '#221F1A',
  inkDim: '#6B6558',
  amber: '#D89A3E',
  line: '#D8CFBB',
  danger: '#B5453A',
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function effectiveTime(line, bpm) {
  if (line.timeSec !== null && line.timeSec !== undefined && line.timeSec !== '') {
    return Number(line.timeSec) || 0;
  }
  if (line.beat !== null && line.beat !== undefined && line.beat !== '') {
    return Math.max(0, (Number(line.beat) - 1) * 60 / (bpm || 1));
  }
  return 0;
}

function sortedLines(song) {
  return [...song.lines]
    .map((l) => ({ ...l, t: effectiveTime(l, song.bpm) }))
    .sort((a, b) => a.t - b.t);
}

function currentIndex(lines, elapsed) {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= elapsed + 0.001) idx = i;
    else break;
  }
  return idx;
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function defaultPlayback() {
  return { songId: null, status: 'stopped', anchorEpoch: Date.now(), anchorElapsed: 0, updatedAt: Date.now() };
}

function computeElapsed(playback) {
  if (playback.status === 'playing') {
    return playback.anchorElapsed + (Date.now() - playback.anchorEpoch) / 1000;
  }
  return playback.anchorElapsed;
}

// --- WebSocket sync -------------------------------------------------------

function useSyncedState() {
  const [songs, setSongs] = useState([]);
  const [playback, setPlayback] = useState(defaultPlayback());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => { if (!cancelled) setConnected(true); };
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        retryTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'state') { setSongs(msg.songs); setPlayback(msg.playback); }
          if (msg.type === 'songs') setSongs(msg.songs);
          if (msg.type === 'playback') setPlayback(msg.playback);
        } catch (e) {}
      };
    }
    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendSongs = useCallback((next) => {
    setSongs(next);
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'setSongs', songs: next }));
    }
  }, []);

  const sendPlayback = useCallback((next) => {
    const withTs = { ...next, updatedAt: Date.now() };
    setPlayback(withTs);
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'setPlayback', playback: withTs }));
    }
  }, []);

  return { songs, playback, connected, sendSongs, sendPlayback };
}

function useElapsed(playback) {
  const [elapsed, setElapsed] = useState(() => computeElapsed(playback));
  useEffect(() => {
    setElapsed(computeElapsed(playback));
    if (playback.status !== 'playing') return;
    const iv = setInterval(() => setElapsed(computeElapsed(playback)), 100);
    return () => clearInterval(iv);
  }, [playback]);
  return elapsed;
}

// --- Views ------------------------------------------------------------------

function ConnectionBadge({ connected }) {
  if (connected) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: COLORS.danger, color: '#fff' }}>
      <WifiOff size={12} /> Keine Verbindung zum Server – versuche erneut zu verbinden…
    </div>
  );
}

function ProjectionView({ songs, playback, elapsed, onExit }) {
  const song = songs.find((s) => s.id === playback.songId) || null;
  const showText = playback.status === 'playing' && song;
  const lines = song ? sortedLines(song) : [];
  const idx = showText ? currentIndex(lines, elapsed) : -1;
  const line = idx >= 0 ? lines[idx] : null;
  const pulseDuration = song ? 60 / (song.bpm || 60) : 1;
  const containerRef = useRef(null);

  const requestFs = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 flex flex-col items-center justify-center select-none" style={{ background: COLORS.stageBg }}>
      {line && (
        <div className="flex flex-col items-center gap-6 px-10 text-center max-w-6xl">
          <div style={{ color: COLORS.stageText, fontFamily: 'Georgia, "Iowan Old Style", ui-serif, serif' }} className="text-6xl md:text-7xl font-semibold leading-tight">
            {line.en}
          </div>
          <div style={{ color: COLORS.stageTextDim, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }} className="text-3xl md:text-4xl font-normal leading-snug">
            {line.de}
          </div>
        </div>
      )}

      {song && playback.status === 'playing' && (
        <div className="fixed bottom-6 right-6 w-3 h-3 rounded-full choir-beat-dot" style={{ background: COLORS.amber, animationDuration: `${pulseDuration}s` }} />
      )}

      <button onClick={requestFs} aria-label="Vollbild" className="fixed top-4 left-4 p-2 rounded opacity-10 hover:opacity-70 transition-opacity" style={{ color: COLORS.stageTextDim, border: `1px solid ${COLORS.stageTextDim}` }}>
        <Maximize2 size={14} />
      </button>
      <button onClick={onExit} aria-label="Projektion verlassen" className="fixed top-4 right-4 p-2 rounded opacity-10 hover:opacity-70 transition-opacity" style={{ color: COLORS.stageTextDim, border: `1px solid ${COLORS.stageTextDim}` }}>
        <X size={14} />
      </button>
    </div>
  );
}

function ControlView({ songs, playback, elapsed, onLoad, onTogglePlay, onStop, onSeek, onNudge, onGotoEditor, onGotoProjection }) {
  const song = songs.find((s) => s.id === playback.songId) || null;
  const lines = song ? sortedLines(song) : [];
  const idx = song ? currentIndex(lines, elapsed) : -1;
  const duration = lines.length ? lines[lines.length - 1].t + 4 : 0;

  return (
    <div className="min-h-screen pb-10" style={{ background: COLORS.panelBg }}>
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Steuerung</h1>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide" style={{ color: COLORS.inkDim }}>Song wählen</div>
          <div className="flex flex-col gap-2">
            {songs.map((s) => (
              <button key={s.id} onClick={() => onLoad(s)} className="text-left px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: s.id === playback.songId ? COLORS.amber : COLORS.panelBg2, color: s.id === playback.songId ? '#241a08' : COLORS.ink }}>
                <span className="font-medium">{s.title}</span>
                <span className="text-xs opacity-70">{s.bpm} BPM</span>
              </button>
            ))}
            {songs.length === 0 && <div className="text-sm" style={{ color: COLORS.inkDim }}>Keine Songs vorhanden. Zum Editor wechseln, um einen zu erstellen.</div>}
          </div>
        </div>

        {song && (
          <div className="space-y-3 pt-2">
            <div className="rounded-xl p-4" style={{ background: COLORS.ink }}>
              <div className="text-xs mb-1" style={{ color: COLORS.line }}>{fmtTime(elapsed)} / {fmtTime(duration)}</div>
              <div className="text-lg font-semibold" style={{ color: COLORS.stageText }}>
                {idx >= 0 ? lines[idx].en : (playback.status === 'playing' ? '…' : '— Schwarz —')}
              </div>
              <div className="text-sm" style={{ color: COLORS.line }}>{idx >= 0 ? lines[idx].de : ''}</div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button onClick={() => onNudge(-5)} aria-label="5 Sekunden zurück" className="p-3 rounded-full" style={{ background: COLORS.panelBg2 }}>
                <SkipBack size={20} color={COLORS.ink} />
              </button>
              <button onClick={onTogglePlay} aria-label={playback.status === 'playing' ? 'Pause und Schwarz' : 'Start'} className="p-5 rounded-full" style={{ background: COLORS.amber }}>
                {playback.status === 'playing' ? <Pause size={28} color="#241a08" /> : <Play size={28} color="#241a08" />}
              </button>
              <button onClick={() => onNudge(5)} aria-label="5 Sekunden vor" className="p-3 rounded-full" style={{ background: COLORS.panelBg2 }}>
                <SkipForward size={20} color={COLORS.ink} />
              </button>
            </div>
            <div className="flex justify-center">
              <button onClick={onStop} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: COLORS.panelBg2, color: COLORS.inkDim }}>
                <Square size={12} /> Stopp &amp; Schwarz
              </button>
            </div>

            <div className="pt-2">
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: COLORS.inkDim }}>An Zeile springen</div>
              <div className="max-h-64 overflow-y-auto rounded-lg divide-y" style={{ borderColor: COLORS.panelBg2 }}>
                {lines.map((l, i) => (
                  <button key={l.id} onClick={() => onSeek(l.t)} className="w-full text-left px-3 py-2 text-sm flex gap-2 items-start" style={{ background: i === idx ? COLORS.amber : 'transparent', color: i === idx ? '#241a08' : COLORS.ink }}>
                    <span className="opacity-60 text-xs w-10 shrink-0 pt-0.5">{fmtTime(l.t)}</span>
                    <span>{l.en}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <button onClick={onGotoEditor} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1" style={{ background: COLORS.panelBg2, color: COLORS.ink }}>
            <Settings2 size={14} /> Songs verwalten
          </button>
          <button onClick={onGotoProjection} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1" style={{ background: COLORS.ink, color: COLORS.stageText }}>
            <Maximize2 size={14} /> Projektion öffnen
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportExport({ songs, onImport }) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('replace');
  const exportText = JSON.stringify(songs, null, 2);

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(exportText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };
  const doImport = () => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('erwartet ein Array von Songs');
      const withIds = parsed.map((s) => ({ ...s, id: s.id || uid(), lines: (s.lines || []).map((l) => ({ ...l, id: l.id || uid() })) }));
      onImport(mode === 'replace' ? withIds : [...songs, ...withIds]);
      setText('');
    } catch (e) { alert('JSON ungültig: ' + e.message); }
  };
  const onFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3 pt-4 mt-4 border-t" style={{ borderColor: COLORS.panelBg2 }}>
      <div className="text-xs uppercase tracking-wide" style={{ color: COLORS.inkDim }}>Import / Export</div>
      <button onClick={doCopy} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: COLORS.panelBg2, color: COLORS.ink }}>
        {copied ? <Check size={12} /> : <Copy size={12} />} Alle Songs als JSON kopieren
      </button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="JSON hier einfügen zum Importieren…" rows={5} className="w-full text-xs rounded-lg p-2 font-mono" style={{ background: COLORS.panelBg2, color: COLORS.ink }} />
      <div className="flex items-center gap-3 flex-wrap">
        <input type="file" accept="application/json" onChange={onFile} className="text-xs" style={{ color: COLORS.inkDim }} />
        <label className="text-xs flex items-center gap-1" style={{ color: COLORS.inkDim }}><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Ersetzen</label>
        <label className="text-xs flex items-center gap-1" style={{ color: COLORS.inkDim }}><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Hinzufügen</label>
        <button onClick={doImport} disabled={!text.trim()} className="text-xs px-3 py-1.5 rounded-full disabled:opacity-40" style={{ background: COLORS.amber, color: '#241a08' }}>Importieren</button>
      </div>
    </div>
  );
}

function SongEditor({ song, onChange, onDelete }) {
  const update = (patch) => onChange({ ...song, ...patch });
  const updateLine = (id, patch) => update({ lines: song.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLine = () => update({ lines: [...song.lines, { id: uid(), en: '', de: '', mode: 'sec', timeSec: 0, beat: '' }] });
  const removeLine = (id) => update({ lines: song.lines.filter((l) => l.id !== id) });
  const moveLine = (id, dir) => {
    const idx = song.lines.findIndex((l) => l.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= song.lines.length) return;
    const next = [...song.lines];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    update({ lines: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={song.title} onChange={(e) => update({ title: e.target.value })} placeholder="Songtitel" className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.panelBg2, color: COLORS.ink }} />
        <input type="number" value={song.bpm} onChange={(e) => update({ bpm: Number(e.target.value) || 1 })} placeholder="BPM" className="w-24 px-3 py-2 rounded-lg text-sm" style={{ background: COLORS.panelBg2, color: COLORS.ink }} />
        <button onClick={onDelete} aria-label="Song löschen" className="px-3 py-2 rounded-lg" style={{ background: COLORS.danger }}><Trash2 size={16} color="#fff" /></button>
      </div>

      <div className="space-y-2">
        {song.lines.map((l) => {
          const t = effectiveTime(l, song.bpm);
          return (
            <div key={l.id} className="rounded-lg p-2 space-y-1" style={{ background: COLORS.panelBg2 }}>
              <input value={l.en} onChange={(e) => updateLine(l.id, { en: e.target.value })} placeholder="Englisch" className="w-full px-2 py-1 rounded text-sm" style={{ background: '#fff', color: COLORS.ink }} />
              <input value={l.de} onChange={(e) => updateLine(l.id, { de: e.target.value })} placeholder="Deutsch (Übersetzung)" className="w-full px-2 py-1 rounded text-sm" style={{ background: '#fff', color: COLORS.ink }} />
              <div className="flex items-center gap-2 flex-wrap">
                <select value={l.mode} onChange={(e) => updateLine(l.id, { mode: e.target.value })} className="text-xs px-1.5 py-1 rounded" style={{ background: '#fff', color: COLORS.ink }}>
                  <option value="sec">Sekunden</option>
                  <option value="beat">Taktschlag</option>
                </select>
                {l.mode === 'sec' ? (
                  <input type="number" step="0.1" value={l.timeSec} onChange={(e) => updateLine(l.id, { timeSec: e.target.value })} className="w-20 text-xs px-1.5 py-1 rounded" style={{ background: '#fff', color: COLORS.ink }} />
                ) : (
                  <input type="number" step="1" value={l.beat} onChange={(e) => updateLine(l.id, { beat: e.target.value })} className="w-20 text-xs px-1.5 py-1 rounded" style={{ background: '#fff', color: COLORS.ink }} />
                )}
                <span className="text-xs" style={{ color: COLORS.inkDim }}>≈ {fmtTime(t)}</span>
                <div className="flex gap-1 ml-auto">
                  <button onClick={() => moveLine(l.id, -1)} aria-label="Zeile nach oben" className="p-1 rounded" style={{ background: '#fff' }}><ChevronUp size={14} /></button>
                  <button onClick={() => moveLine(l.id, 1)} aria-label="Zeile nach unten" className="p-1 rounded" style={{ background: '#fff' }}><ChevronDown size={14} /></button>
                  <button onClick={() => removeLine(l.id)} aria-label="Zeile löschen" className="p-1 rounded" style={{ background: '#fff' }}><Trash2 size={14} color={COLORS.danger} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={addLine} className="w-full text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1" style={{ background: COLORS.amber, color: '#241a08' }}>
        <Plus size={14} /> Zeile hinzufügen
      </button>
    </div>
  );
}

function EditorView({ songs, onChangeSongs, onBack }) {
  const [selectedId, setSelectedId] = useState(songs[0] ? songs[0].id : null);
  const selected = songs.find((s) => s.id === selectedId) || null;

  const addSong = () => {
    const s = { id: uid(), title: 'Neuer Song', bpm: 90, lines: [] };
    onChangeSongs([...songs, s]);
    setSelectedId(s.id);
  };
  const updateSong = (next) => onChangeSongs(songs.map((s) => (s.id === next.id ? next : s)));
  const deleteSong = (id) => {
    onChangeSongs(songs.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.panelBg }}>
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Songs verwalten</h1>
          <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg" style={{ background: COLORS.panelBg2, color: COLORS.ink }}>Zur Steuerung</button>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:w-56 shrink-0 space-y-2">
            {songs.map((s) => (
              <button key={s.id} onClick={() => setSelectedId(s.id)} className="w-full text-left px-3 py-2 rounded-lg text-sm" style={{ background: s.id === selectedId ? COLORS.amber : COLORS.panelBg2, color: s.id === selectedId ? '#241a08' : COLORS.ink }}>{s.title}</button>
            ))}
            <button onClick={addSong} className="w-full text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1" style={{ background: COLORS.ink, color: COLORS.stageText }}><Plus size={14} /> Neuer Song</button>
          </div>
          <div className="flex-1 min-w-0">
            {selected ? <SongEditor song={selected} onChange={updateSong} onDelete={() => deleteSong(selected.id)} /> : <div className="text-sm" style={{ color: COLORS.inkDim }}>Song auswählen oder neu erstellen.</div>}
            <ImportExport songs={songs} onImport={onChangeSongs} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('control');
  const { songs, playback, connected, sendSongs, sendPlayback } = useSyncedState();
  const elapsed = useElapsed(playback);

  const loadSong = (song) => sendPlayback({ songId: song.id, status: 'stopped', anchorEpoch: Date.now(), anchorElapsed: 0 });
  const togglePlay = () => {
    if (playback.status === 'playing') {
      sendPlayback({ ...playback, status: 'paused', anchorElapsed: computeElapsed(playback), anchorEpoch: Date.now() });
    } else {
      sendPlayback({ ...playback, status: 'playing', anchorEpoch: Date.now() });
    }
  };
  const stopSong = () => sendPlayback({ ...playback, status: 'stopped', anchorElapsed: 0, anchorEpoch: Date.now() });
  const seekTo = (sec) => sendPlayback({ ...playback, anchorElapsed: Math.max(0, sec), anchorEpoch: Date.now() });
  const nudge = (delta) => seekTo(computeElapsed(playback) + delta);

  return (
    <>
      <ConnectionBadge connected={connected} />
      <style>{`
        .choir-beat-dot { animation-name: choirBeatPulse; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes choirBeatPulse { 0% { transform: scale(1); opacity: .15; } 15% { transform: scale(1.8); opacity: .55; } 100% { transform: scale(1); opacity: .15; } }
        @media (prefers-reduced-motion: reduce) { .choir-beat-dot { animation: none; opacity: .3; } }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${COLORS.amber}; outline-offset: 2px; }
      `}</style>
      {view === 'projection' ? (
        <ProjectionView songs={songs} playback={playback} elapsed={elapsed} onExit={() => setView('control')} />
      ) : view === 'editor' ? (
        <EditorView songs={songs} onChangeSongs={sendSongs} onBack={() => setView('control')} />
      ) : (
        <ControlView
          songs={songs}
          playback={playback}
          elapsed={elapsed}
          onLoad={loadSong}
          onTogglePlay={togglePlay}
          onStop={stopSong}
          onSeek={seekTo}
          onNudge={nudge}
          onGotoEditor={() => setView('editor')}
          onGotoProjection={() => setView('projection')}
        />
      )}
    </>
  );
}
