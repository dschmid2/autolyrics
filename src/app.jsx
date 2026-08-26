import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Plus, Trash2, ChevronUp, ChevronDown, Maximize2, X, Settings2, Copy, Check, WifiOff, QrCode, Upload, ZoomIn, ZoomOut, Music, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import versionData from './version.json';

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

function getOrCreatePlayerId() {
  try {
    let id = localStorage.getItem('autolyrics_player_id');
    if (!id) {
      id = 'player-' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('autolyrics_player_id', id);
    }
    return id;
  } catch (e) {
    return 'player-' + Math.random().toString(36).substring(2, 8);
  }
}

function computeLinesWithTimes(song) {
  if (!song || !Array.isArray(song.lines)) return [];
  const bpm = Number(song.bpm) || 90;
  const timeSigNum = Number(song.timeSigNum) || 4;
  const lines = [];
  let prevTime = 0;

  for (let i = 0; i < song.lines.length; i++) {
    const l = song.lines[i];
    let t = 0;
    if (l.mode === 'sec') {
      t = Number(l.timeSec) || 0;
    } else if (l.mode === 'relative') {
      const rel = Number(l.relativeSec) || 0;
      t = prevTime + rel;
    } else if (l.mode === 'relative_bar_beat') {
      const relBar = Number(l.relativeBar) || 0;
      const relBeat = Number(l.relativeBeat) || 0;
      const totalBeats = relBar * timeSigNum + relBeat;
      t = prevTime + totalBeats * (60 / bpm);
    } else if (l.mode === 'bar_beat') {
      const bar = Number(l.bar) || 1;
      const beat = Number(l.beat) || 1;
      const totalBeats = (bar - 1) * timeSigNum + (beat - 1);
      t = Math.max(0, totalBeats * (60 / bpm));
    } else if (l.mode === 'beat') {
      const beat = Number(l.beat) || 1;
      t = Math.max(0, (beat - 1) * 60 / bpm);
    } else {
      t = Number(l.timeSec) || 0;
    }

    const duration = l.duration !== undefined && l.duration !== null && l.duration !== '' ? Number(l.duration) : null;
    lines.push({ ...l, t, duration });
    prevTime = t;
  }

  return lines.sort((a, b) => a.t - b.t);
}

function sortedLines(song) {
  return computeLinesWithTimes(song);
}

function getSongDuration(lines) {
  if (!lines || !lines.length) return 0;
  const lastLine = lines[lines.length - 1];
  const dur = lastLine.duration !== null && lastLine.duration !== undefined && lastLine.duration !== '' ? Number(lastLine.duration) : 4;
  return lastLine.t + dur;
}

function currentIndex(lines, elapsed) {
  if (!lines || !lines.length) return -1;
  const duration = getSongDuration(lines);
  if (elapsed >= duration) return -1;

  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= elapsed + 0.001) {
      idx = i;
    } else {
      break;
    }
  }
  if (idx >= 0) {
    const line = lines[idx];
    if (line.duration !== null && line.duration !== undefined && line.duration !== '') {
      if (elapsed > line.t + Number(line.duration)) {
        return -1;
      }
    }
  }
  return idx;
}

function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtTimeWithTenths(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const tenths = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, '0')}.${tenths}`;
}

function updateLineTimestamp(line, newTime, song, prevLineTime) {
  const mode = line.mode || 'sec';
  const bpm = Number(song.bpm) || 90;
  const timeSigNum = Number(song.timeSigNum) || 4;

  if (mode === 'sec') {
    return { timeSec: Math.max(0, Math.round(newTime * 100) / 100) };
  } else if (mode === 'bar_beat') {
    const totalBeats = Math.max(0, newTime * (bpm / 60));
    const bar = Math.floor(totalBeats / timeSigNum) + 1;
    const beat = Math.floor(totalBeats % timeSigNum) + 1;
    return { bar, beat };
  } else if (mode === 'beat') {
    const beat = Math.max(1, Math.round(newTime * (bpm / 60)) + 1);
    return { beat };
  } else if (mode === 'relative') {
    const relSec = Math.max(0, Math.round((newTime - (prevLineTime || 0)) * 100) / 100);
    return { relativeSec: relSec };
  } else if (mode === 'relative_bar_beat') {
    const diffSec = Math.max(0, newTime - (prevLineTime || 0));
    const totalBeats = diffSec * (bpm / 60);
    const relativeBar = Math.floor(totalBeats / timeSigNum);
    const relativeBeat = Math.round(totalBeats % timeSigNum);
    return { relativeBar, relativeBeat };
  }
  return { timeSec: Math.max(0, Math.round(newTime * 100) / 100) };
}

function useAudioBuffer(audioUrl) {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!audioUrl) {
      setAudioBuffer(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(audioUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Audio konnte nicht geladen werden');
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        return ctx.decodeAudioData(arrayBuffer);
      })
      .then((buffer) => {
        if (!cancelled) {
          setAudioBuffer(buffer);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Fehler beim Dekodieren');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  return { audioBuffer, loading, error };
}

function WaveformCanvas({ audioBuffer, pxPerSec, bpm, timeSigNum, duration, width, height = 110, audioOffset = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = data.length;

    const secondsPerBeat = 60 / (bpm || 90);
    const secondsPerBar = secondsPerBeat * (timeSigNum || 4);
    const totalBars = Math.ceil(duration / secondsPerBar) + 1;

    for (let bar = 0; bar < totalBars; bar++) {
      const barTime = bar * secondsPerBar;
      const x = barTime * pxPerSec;
      if (x > width) break;

      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px monospace';
      ctx.fillText(`T${bar + 1}`, x + 3, 12);

      for (let beat = 1; beat < timeSigNum; beat++) {
        const beatTime = barTime + beat * secondsPerBeat;
        const bx = beatTime * pxPerSec;
        if (bx > width) break;
        ctx.strokeStyle = '#27272a';
        ctx.beginPath();
        ctx.moveTo(bx, 15);
        ctx.lineTo(bx, height);
        ctx.stroke();
      }
    }

    const centerY = height / 2;
    ctx.fillStyle = '#d89a3e';

    for (let x = 0; x < width; x++) {
      const songTime = x / pxPerSec;
      const audioTime = songTime - audioOffset;

      if (audioTime < 0 || audioTime >= audioBuffer.duration) {
        continue;
      }

      const startSample = Math.floor(audioTime * sampleRate);
      const endSample = Math.min(totalSamples, Math.floor((audioTime + 1 / pxPerSec) * sampleRate));

      if (startSample >= totalSamples || startSample < 0) continue;

      let min = 1.0;
      let max = -1.0;
      for (let i = startSample; i < endSample; i++) {
        const sample = data[i];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      if (min > max) {
        min = 0;
        max = 0;
      }

      const top = centerY - max * (height / 2.2);
      const bottom = centerY - min * (height / 2.2);
      const barHeight = Math.max(1, bottom - top);

      ctx.fillRect(x, top, 1, barHeight);
    }
  }, [audioBuffer, pxPerSec, bpm, timeSigNum, duration, width, height, audioOffset]);

  return <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px`, display: 'block' }} />;
}

function WaveformEditor({ song, computedLines, onUpdateSong }) {
  const { audioBuffer, loading, error } = useAudioBuffer(song.audioUrl);
  const audioRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const [markerDragMode, setMarkerDragMode] = useState('single');

  const audioOffset = Number(song.audioOffset) || 0;
  const audioDuration = audioBuffer ? audioBuffer.duration : 0;
  const songDuration = getSongDuration(computedLines);
  const totalDuration = Math.max(10, songDuration + 5, (audioDuration + audioOffset) + 5, audioOffset + 10);
  const canvasWidth = Math.max(800, Math.ceil(totalDuration * pxPerSec));

  const bpm = Number(song.bpm) || 90;
  const timeSigNum = Number(song.timeSigNum) || 4;
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    let animId;
    const update = () => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      if (isPlaying) {
        setCurrentTime((prev) => {
          const nextSongTime = Math.max(0, prev + delta);
          const targetAudioTime = nextSongTime - audioOffset;

          if (audioRef.current && audioBuffer) {
            if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
              if (audioRef.current.paused) {
                audioRef.current.currentTime = targetAudioTime;
                audioRef.current.play().catch(() => {});
              } else {
                const diff = Math.abs(audioRef.current.currentTime - targetAudioTime);
                if (diff > 0.15) {
                  audioRef.current.currentTime = targetAudioTime;
                }
              }
            } else {
              if (!audioRef.current.paused) {
                audioRef.current.pause();
              }
            }
          }
          return nextSongTime;
        });
        animId = requestAnimationFrame(update);
      }
    };

    if (isPlaying) {
      lastTickRef.current = Date.now();
      animId = requestAnimationFrame(update);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, audioOffset, audioBuffer, audioDuration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const targetAudioTime = currentTime - audioOffset;
      if (audioBuffer && targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        audioRef.current.currentTime = targetAudioTime;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        setIsPlaying(true);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const seekNudge = (delta) => {
    const newSongTime = Math.max(0, Math.min(totalDuration, currentTime + delta));
    setCurrentTime(newSongTime);
    const targetAudioTime = newSongTime - audioOffset;
    if (audioRef.current && audioBuffer) {
      if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        audioRef.current.currentTime = targetAudioTime;
      } else {
        audioRef.current.pause();
      }
    }
  };

  const addMarkerAtCurrentTime = () => {
    const t = Math.round(currentTime * 100) / 100;
    const newLine = {
      id: uid(),
      en: '',
      de: '',
      mode: 'sec',
      timeSec: t,
      duration: ''
    };
    onUpdateSong({ lines: [...song.lines, newLine] });
  };

  const totalBeats = currentTime * (bpm / 60);
  const currentBar = Math.floor(totalBeats / timeSigNum) + 1;
  const currentBeat = Math.floor(totalBeats % timeSigNum) + 1;

  const activeIdx = currentIndex(computedLines, currentTime);
  const activeLine = activeIdx >= 0 ? computedLines[activeIdx] : null;

  const handleContainerClick = (e) => {
    if (isDragging) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const seekTime = Math.max(0, Math.min(totalDuration, x / pxPerSec));
    setCurrentTime(seekTime);
    const targetAudioTime = seekTime - audioOffset;
    if (audioRef.current && audioBuffer) {
      if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        audioRef.current.currentTime = targetAudioTime;
      } else {
        audioRef.current.pause();
      }
    }
  };

  const handleAudioOffsetPointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    const container = containerRef.current;
    if (!container) return;

    const onPointerMove = (moveEv) => {
      const rect = container.getBoundingClientRect();
      const x = moveEv.clientX - rect.left + container.scrollLeft;
      const newOffset = Math.round((x / pxPerSec) * 10) / 10;
      onUpdateSong({ audioOffset: newOffset });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleMarkerPointerDown = (e, line, lineIdx) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    const container = containerRef.current;
    if (!container) return;

    const initialComputedLines = [...computedLines];
    const origTime = initialComputedLines[lineIdx] ? initialComputedLines[lineIdx].t : 0;

    const onPointerMove = (moveEv) => {
      const rect = container.getBoundingClientRect();
      const x = moveEv.clientX - rect.left + container.scrollLeft;
      const newTime = Math.max(0, Math.min(totalDuration, x / pxPerSec));
      const deltaT = newTime - origTime;

      if (markerDragMode === 'single') {
        let prevTime = 0;
        if (lineIdx > 0 && initialComputedLines[lineIdx - 1]) {
          prevTime = initialComputedLines[lineIdx - 1].t;
        }
        const patch = updateLineTimestamp(line, newTime, song, prevTime);
        const updatedLines = song.lines.map((l) => (l.id === line.id ? { ...l, ...patch } : l));
        onUpdateSong({ lines: updatedLines });
      } else {
        const mapUpdated = new Map();
        let currentPrevTime = lineIdx > 0 && initialComputedLines[lineIdx - 1] ? initialComputedLines[lineIdx - 1].t : 0;

        for (let j = lineIdx; j < initialComputedLines.length; j++) {
          const item = initialComputedLines[j];
          const targetTime = j === lineIdx ? newTime : Math.max(0, item.t + deltaT);
          const patch = updateLineTimestamp(item, targetTime, song, currentPrevTime);
          mapUpdated.set(item.id, patch);
          currentPrevTime = targetTime;
        }

        const updatedLines = song.lines.map((l) => {
          if (mapUpdated.has(l.id)) {
            return { ...l, ...mapUpdated.get(l.id) };
          }
          return l;
        });
        onUpdateSong({ lines: updatedLines });
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: '#0F0F12', color: '#F4EFE4' }}>
      <audio
        ref={audioRef}
        src={song.audioUrl}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Top Banner: Preview & Live Clock */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
        <div className="md:col-span-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Vorschau (Aktuelle Zeile)</div>
          <div className="text-base font-semibold truncate text-zinc-100">
            {activeLine ? activeLine.en : <span className="text-zinc-500 italic">— Schwarz / Pause —</span>}
          </div>
          {activeLine && activeLine.de && (
            <div className="text-xs text-zinc-400 truncate">{activeLine.de}</div>
          )}
        </div>

        <div className="flex flex-col justify-center space-y-1 md:border-l md:border-zinc-800 md:pl-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
            <Clock size={12} /> Live-Uhr
          </div>
          <div className="text-sm font-mono font-bold text-amber-400">
            {fmtTimeWithTenths(currentTime)} <span className="text-xs text-zinc-400">({currentTime.toFixed(1)}s)</span>
          </div>
          <div className="text-xs font-mono text-zinc-300">
            Takt <span className="text-amber-400 font-bold">{currentBar}</span>, Schlag <span className="text-amber-400 font-bold">{currentBeat}</span> / {timeSigNum}
          </div>
        </div>
      </div>

      {/* Controls & Zoom Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium"
            style={{ background: COLORS.amber, color: '#241a08' }}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pause' : 'Abspielen'}
          </button>
          <button
            onClick={stopAudio}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            title="Stopp"
          >
            <Square size={14} />
          </button>
          <button
            onClick={() => seekNudge(-5)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            title="5s zurück"
          >
            <SkipBack size={14} />
          </button>
          <button
            onClick={() => seekNudge(5)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            title="5s vor"
          >
            <SkipForward size={14} />
          </button>

          <button
            onClick={addMarkerAtCurrentTime}
            className="ml-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-medium flex items-center gap-1 border border-zinc-700"
          >
            <Plus size={14} /> Marker setzen ({fmtTimeWithTenths(currentTime)})
          </button>

          <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg text-xs" title="Audio Startzeitpunkt im Song verschieben (positiv = Audio startet später, negativ = Audio startet früher)">
            <span className="text-zinc-300 font-medium">Audio-Offset:</span>
            <input
              type="number"
              step="0.1"
              value={song.audioOffset !== undefined && song.audioOffset !== null ? song.audioOffset : 0}
              onChange={(e) => onUpdateSong({ audioOffset: Number(e.target.value) || 0 })}
              className="w-16 px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 font-mono text-xs border border-zinc-700 text-right"
            />
            <span className="text-zinc-400 font-mono text-[10px]">s</span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 p-0.5 rounded-lg text-xs" title="Bearbeitungsmodus für Marker-Verschiebung">
            <span className="text-zinc-400 font-medium px-1.5 text-[11px]">Verschiebe-Modus:</span>
            <button
              onClick={() => setMarkerDragMode('single')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                markerDragMode === 'single'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-zinc-300 hover:text-white'
              }`}
              title="Nur den ausgewählten Marker verschieben"
            >
              Nur dieser Marker
            </button>
            <button
              onClick={() => setMarkerDragMode('following')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                markerDragMode === 'following'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-zinc-300 hover:text-white'
              }`}
              title="Diesen und alle folgenden Marker verschieben"
            >
              Dieser &amp; folgende
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <ZoomOut size={14} className="text-zinc-400" />
          <input
            type="range"
            min="15"
            max="250"
            value={pxPerSec}
            onChange={(e) => setPxPerSec(Number(e.target.value))}
            className="w-24 accent-amber-500 cursor-pointer"
            title="Wellenform Zoom"
          />
          <ZoomIn size={14} className="text-zinc-400" />
          <span className="font-mono text-[10px] text-zinc-400">{pxPerSec}px/s</span>
        </div>
      </div>

      {/* Waveform & Marker Area */}
      {loading ? (
        <div className="p-8 text-center text-xs text-zinc-400 animate-pulse">Lade MP3-Wellenform…</div>
      ) : error ? (
        <div className="p-4 text-center text-xs text-red-400 bg-red-950/30 rounded-lg">{error}</div>
      ) : (
        <div
          ref={containerRef}
          onClick={handleContainerClick}
          className="relative overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 select-none cursor-crosshair"
          style={{ minHeight: '130px' }}
        >
          <WaveformCanvas
            audioBuffer={audioBuffer}
            pxPerSec={pxPerSec}
            bpm={bpm}
            timeSigNum={timeSigNum}
            duration={totalDuration}
            width={canvasWidth}
            height={110}
            audioOffset={audioOffset}
          />

          {/* Audio Start Offset Drag Handle */}
          <div
            onPointerDown={handleAudioOffsetPointerDown}
            className="absolute top-0 bottom-0 z-25 group cursor-ew-resize flex flex-col items-center"
            style={{ left: `${Math.max(0, audioOffset * pxPerSec)}px`, transform: 'translateX(-50%)' }}
          >
            <div
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded shadow-md bg-blue-600 text-white hover:bg-blue-500 border border-blue-400 select-none whitespace-nowrap"
              title="Audio-Start Offset verschieben"
            >
              ♫ Audio-Start ({audioOffset > 0 ? `+${audioOffset.toFixed(1)}` : audioOffset.toFixed(1)}s)
            </div>
            <div className="w-0.5 flex-1 bg-blue-500 group-hover:bg-blue-400 group-hover:w-1 transition-all" />
          </div>

          {/* Real-time Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{ left: `${currentTime * pxPerSec}px` }}
          >
            <div className="w-2 h-2 -ml-[3px] bg-red-500 rotate-45" />
          </div>

          {/* Lyric Line Markers */}
          {computedLines.map((l, i) => {
            const posX = l.t * pxPerSec;
            const isActive = i === activeIdx;
            const lineNum = i + 1;
            const labelText = l.en ? (l.en.length > 12 ? l.en.substring(0, 12) + '…' : l.en) : `Z${lineNum}`;

            return (
              <div
                key={l.id}
                onPointerDown={(e) => handleMarkerPointerDown(e, l, i)}
                className="absolute top-0 bottom-0 z-30 group cursor-ew-resize flex flex-col items-center"
                style={{ left: `${posX}px`, transform: 'translateX(-50%)' }}
              >
                {/* Marker Top Badge */}
                <div
                  className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded shadow-md transition-all whitespace-nowrap select-none ${
                    isActive
                      ? 'bg-amber-400 text-black scale-110 ring-2 ring-amber-300'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                  }`}
                  title={`${l.en || 'Zeile ' + lineNum} (${fmtTimeWithTenths(l.t)})`}
                >
                  #{lineNum} {labelText}
                </div>

                {/* Marker Line */}
                <div
                  className={`w-0.5 flex-1 transition-all ${
                    isActive ? 'bg-amber-400 w-1 shadow-[0_0_8px_#d89a3e]' : 'bg-amber-600/70 group-hover:bg-amber-400'
                  }`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function defaultPlayback() {
  return {
    songId: null,
    status: 'stopped',
    anchorEpoch: Date.now(),
    anchorElapsed: 0,
    updatedAt: Date.now(),
    fontSize: 64,
    translationPercent: 60,
    positionX: 50,
    positionY: 50,
    showHeartbeat: true,
    stagePastLines: 2,
    stageFutureLines: 2,
    stageLeadSeconds: 0
  };
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
  const [players, setPlayers] = useState({});
  const [connected, setConnected] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('');
  const playerIdRef = useRef(getOrCreatePlayerId());
  const wsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) {
          setConnected(true);
          ws.send(JSON.stringify({ type: 'registerPlayer', playerId: playerIdRef.current }));
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        retryTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'state') {
            setSongs(msg.songs);
            setPlayback(msg.playback);
            if (msg.players) setPlayers(msg.players);
            if (msg.serverIp) setServerIp(msg.serverIp);
            if (msg.serverPort) setServerPort(msg.serverPort);
          }
          if (msg.type === 'songs') setSongs(msg.songs);
          if (msg.type === 'playback') setPlayback(msg.playback);
          if (msg.type === 'players') setPlayers(msg.players);
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

  const sendPlayerRole = useCallback((targetPlayerId, role) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'setPlayerRole', playerId: targetPlayerId, role }));
    }
  }, []);

  const sendDeletePlayer = useCallback((targetPlayerId) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'deletePlayer', playerId: targetPlayerId }));
    }
  }, []);

  return {
    songs,
    playback,
    players,
    connected,
    playerId: playerIdRef.current,
    sendSongs,
    sendPlayback,
    sendPlayerRole,
    sendDeletePlayer,
    serverIp,
    serverPort,
  };
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

function OptionsView({ playback, onChangePlayback, onBack }) {
  const fontSize = playback.fontSize !== undefined ? playback.fontSize : 64;
  const translationPercent = playback.translationPercent !== undefined ? playback.translationPercent : 60;
  const positionX = playback.positionX !== undefined ? playback.positionX : 50;
  const positionY = playback.positionY !== undefined ? playback.positionY : 50;
  const showHeartbeat = playback.showHeartbeat !== undefined ? playback.showHeartbeat : true;
  const stagePastLines = playback.stagePastLines !== undefined ? playback.stagePastLines : 2;
  const stageFutureLines = playback.stageFutureLines !== undefined ? playback.stageFutureLines : 2;
  const stageLeadSeconds = playback.stageLeadSeconds !== undefined ? playback.stageLeadSeconds : 0;

  return (
    <div className="min-h-screen pb-10" style={{ background: COLORS.panelBg }}>
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Anzeige-Optionen</h1>
          <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg" style={{ background: COLORS.panelBg2, color: COLORS.ink }}>Zurück</button>
        </div>

        <div className="rounded-xl p-4 space-y-4" style={{ background: COLORS.panelBg2 }}>
          <div className="space-y-1">
            <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
              <span>Schriftgrösse Haupttext</span>
              <span className="font-mono">{fontSize}px</span>
            </div>
            <input
              type="range"
              min="20"
              max="120"
              value={fontSize}
              onChange={(e) => onChangePlayback({ fontSize: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
              <span>Grösse Übersetzung</span>
              <span className="font-mono">{translationPercent}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              value={translationPercent}
              onChange={(e) => onChangePlayback({ translationPercent: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Position X (Zentrum)</span>
                <span className="font-mono">{positionX}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={positionX}
                onChange={(e) => onChangePlayback({ positionX: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Position Y (Zentrum)</span>
                <span className="font-mono">{positionY}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={positionY}
                onChange={(e) => onChangePlayback({ positionY: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="showHeartbeat"
              checked={showHeartbeat}
              onChange={(e) => onChangePlayback({ showHeartbeat: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 accent-amber"
            />
            <label htmlFor="showHeartbeat" className="text-xs font-medium cursor-pointer" style={{ color: COLORS.ink }}>
              Pulsierender Punkt (Heartbeat) aktivieren
            </label>
          </div>

          <div className="border-t pt-3 mt-3 space-y-3" style={{ borderColor: COLORS.line }}>
            <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>Stage-View Optionen</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                  <span>Vergangene Zeilen</span>
                  <span className="font-mono">{stagePastLines}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={stagePastLines}
                  onChange={(e) => onChangePlayback({ stagePastLines: Number(e.target.value) })}
                  className="w-full accent-amber"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                  <span>Zukünftige Zeilen</span>
                  <span className="font-mono">{stageFutureLines}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={stageFutureLines}
                  onChange={(e) => onChangePlayback({ stageFutureLines: Number(e.target.value) })}
                  className="w-full accent-amber"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Bühnenvorlauf (Sekunden früher)</span>
                <span className="font-mono">{stageLeadSeconds}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={stageLeadSeconds}
                onChange={(e) => onChangePlayback({ stageLeadSeconds: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnassignedPlayerView({ playerId }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none" style={{ background: COLORS.stageBg, color: COLORS.stageText }}>
      <div className="max-w-md w-full p-8 rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-2xl space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <QrCode size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">Player registriert</h2>
          <p className="text-sm text-zinc-400">
            Zuweisung fehlt noch. Bitte in der Steuerung eine Rolle (Stage oder Live) zuweisen.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Player ID</div>
          <div className="text-lg font-mono font-bold text-amber-400 select-all">{playerId}</div>
        </div>
      </div>
    </div>
  );
}

function ConnectionBadge({ connected }) {
  if (connected) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: COLORS.danger, color: '#fff' }}>
      <WifiOff size={12} /> Keine Verbindung zum Server – versuche erneut zu verbinden…
    </div>
  );
}

function StageView({ songs, playback, elapsed, onExit }) {
  const song = songs.find((s) => s.id === playback.songId) || null;
  const lines = song ? sortedLines(song) : [];
  const stageLeadSeconds = playback.stageLeadSeconds !== undefined ? playback.stageLeadSeconds : 0;
  const idx = song ? currentIndex(lines, elapsed + stageLeadSeconds) : -1;
  const currentIdx = idx >= 0 ? idx : 0;

  const fontSize = playback.fontSize !== undefined ? playback.fontSize : 64;
  const showHeartbeat = playback.showHeartbeat !== undefined ? playback.showHeartbeat : true;
  const pastCount = playback.stagePastLines !== undefined ? playback.stagePastLines : 2;
  const futureCount = playback.stageFutureLines !== undefined ? playback.stageFutureLines : 2;

  const pulseDuration = song ? 60 / (song.bpm || 60) : 1;
  const containerRef = useRef(null);

  const requestFs = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const items = [];

  // Vergangene Zeilen
  for (let i = pastCount; i >= 1; i--) {
    const lineIdx = currentIdx - i;
    if (lineIdx >= 0 && lineIdx < lines.length) {
      items.push({ line: lines[lineIdx], isCurrent: false, key: `past-${lineIdx}` });
    } else {
      items.push({ line: null, isCurrent: false, key: `past-empty-${i}` });
    }
  }

  // Aktuelle Zeile
  if (lines.length > 0) {
    items.push({ line: lines[currentIdx], isCurrent: true, key: `current-${currentIdx}` });
  } else {
    items.push({ line: null, isCurrent: false, key: 'current-empty' });
  }

  // Zukünftige Zeilen
  for (let i = 1; i <= futureCount; i++) {
    const lineIdx = currentIdx + i;
    if (lineIdx >= 0 && lineIdx < lines.length) {
      items.push({ line: lines[lineIdx], isCurrent: false, key: `future-${lineIdx}` });
    } else {
      items.push({ line: null, isCurrent: false, key: `future-empty-${i}` });
    }
  }

  return (
    <div ref={containerRef} className="fixed inset-0 select-none flex flex-col justify-center items-center px-6 overflow-hidden" style={{ background: COLORS.stageBg }}>
      <div className="flex flex-col items-center justify-center text-center w-full max-w-5xl space-y-6 md:space-y-8">
        {items.map((item) => {
          if (!item.line) {
            return (
              <div
                key={item.key}
                style={{ height: `${fontSize * 1.2}px` }}
                className="w-full shrink-0"
              />
            );
          }

          if (item.isCurrent) {
            return (
              <div
                key={item.key}
                style={{
                  color: COLORS.stageText,
                  fontFamily: 'Georgia, "Iowan Old Style", ui-serif, serif',
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.2'
                }}
                className="font-bold w-full transition-all duration-300 transform scale-105 shrink-0"
              >
                {item.line.en}
              </div>
            );
          } else {
            return (
              <div
                key={item.key}
                style={{
                  color: COLORS.stageTextDim,
                  fontFamily: 'Georgia, "Iowan Old Style", ui-serif, serif',
                  fontSize: `${fontSize * 0.75}px`,
                  lineHeight: '1.2'
                }}
                className="font-normal w-full opacity-40 transition-all duration-300 shrink-0"
              >
                {item.line.en}
              </div>
            );
          }
        })}
      </div>

      {song && playback.status === 'playing' && showHeartbeat && (
        <div className="fixed bottom-6 right-6 w-3 h-3 rounded-full choir-beat-dot" style={{ background: COLORS.amber, animationDuration: `${pulseDuration}s` }} />
      )}

      {/* Unsichtbarer Zurück-Knopf oben rechts, wird bei Hover/Focus leicht sichtbar */}
      <button
        onClick={onExit}
        aria-label="Stageview verlassen"
        className="fixed top-4 right-4 p-4 rounded opacity-0 hover:opacity-40 focus-visible:opacity-40 transition-opacity z-50 text-white"
        style={{ border: `1px solid ${COLORS.stageTextDim}` }}
      >
        <X size={20} />
      </button>

      {/* Vollbild-Knopf oben links, ebenfalls unsichtbar/leicht sichtbar auf Hover */}
      <button
        onClick={requestFs}
        aria-label="Vollbild"
        className="fixed top-4 left-4 p-4 rounded opacity-0 hover:opacity-40 focus-visible:opacity-40 transition-opacity z-50 text-white"
        style={{ border: `1px solid ${COLORS.stageTextDim}` }}
      >
        <Maximize2 size={20} />
      </button>
    </div>
  );
}

function ProjectionView({ songs, playback, elapsed, onExit, connected }) {
  const [blackout, setBlackout] = useState(false);

  useEffect(() => {
    if (connected) {
      setBlackout(false);
      return;
    }

    // Set a timer to trigger blackout after 30 seconds of disconnected state
    const timer = setTimeout(() => {
      setBlackout(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, [connected]);

  const song = songs.find((s) => s.id === playback.songId) || null;
  const showText = !blackout && playback.status === 'playing' && song;
  const lines = song ? sortedLines(song) : [];
  const duration = getSongDuration(lines);
  const isSongCompleted = song && elapsed >= duration;
  const idx = showText ? currentIndex(lines, elapsed) : -1;
  const line = idx >= 0 ? lines[idx] : null;
  const pulseDuration = song ? 60 / (song.bpm || 60) : 1;
  const containerRef = useRef(null);

  const fontSize = playback.fontSize !== undefined ? playback.fontSize : 64;
  const translationPercent = playback.translationPercent !== undefined ? playback.translationPercent : 60;
  const positionX = playback.positionX !== undefined ? playback.positionX : 50;
  const positionY = playback.positionY !== undefined ? playback.positionY : 50;
  const showHeartbeat = playback.showHeartbeat !== undefined ? playback.showHeartbeat : true;

  const requestFs = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 select-none" style={{ background: COLORS.stageBg }}>
      {line && (
        <div
          className="absolute flex flex-col items-center gap-6 px-10 text-center max-w-6xl pointer-events-none"
          style={{
            left: `${positionX}%`,
            top: `${positionY}%`,
            transform: 'translate(-50%, -50%)',
            width: '100%',
          }}
        >
          <div
            style={{
              color: COLORS.stageText,
              fontFamily: 'Georgia, "Iowan Old Style", ui-serif, serif',
              fontSize: `${fontSize}px`,
            }}
            className="font-semibold leading-tight"
          >
            {line.en}
          </div>
          <div
            style={{
              color: COLORS.stageTextDim,
              fontFamily: 'ui-sans-serif, system-ui, sans-serif',
              fontSize: `${fontSize * translationPercent / 100}px`,
            }}
            className="font-normal leading-snug"
          >
            {line.de}
          </div>
        </div>
      )}

      {song && playback.status === 'playing' && showHeartbeat && !isSongCompleted && !blackout && (
        <div className="fixed bottom-6 right-6 w-3 h-3 rounded-full choir-beat-dot" style={{ background: COLORS.amber, animationDuration: `${pulseDuration}s` }} />
      )}

      {/* Invisible exit button in top-right corner to return to control screen */}
      <button
        onClick={onExit}
        aria-label="Zurück zur Steuerung"
        className="fixed top-0 right-0 w-24 h-24 bg-transparent border-0 outline-none z-50 cursor-default focus:opacity-0"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      />

      <button onClick={requestFs} aria-label="Vollbild" className="fixed top-4 left-4 p-2 rounded opacity-10 hover:opacity-70 transition-opacity" style={{ color: COLORS.stageTextDim, border: `1px solid ${COLORS.stageTextDim}` }}>
        <Maximize2 size={14} />
      </button>
      <button onClick={onExit} aria-label="Projektion verlassen" className="fixed top-4 right-4 p-2 rounded opacity-10 hover:opacity-70 transition-opacity" style={{ color: COLORS.stageTextDim, border: `1px solid ${COLORS.stageTextDim}` }}>
        <X size={14} />
      </button>
    </div>
  );
}

function ControlView({
  songs,
  playback,
  players = {},
  localPlayerId,
  onSetPlayerRole,
  onDeletePlayer,
  elapsed,
  serverIp,
  serverPort,
  onLoad,
  onTogglePlay,
  onStop,
  onSeek,
  onNudge,
  onChangePlayback,
  onGotoEditor,
  onGotoProjection,
  onGotoOptions,
  onGotoStage
}) {
  const song = songs.find((s) => s.id === playback.songId) || null;
  const lines = song ? sortedLines(song) : [];
  const idx = song ? currentIndex(lines, elapsed) : -1;
  const duration = getSongDuration(lines);

  const [showQrSection, setShowQrSection] = useState(false);
  const [showPlayersSection, setShowPlayersSection] = useState(true);
  const [qrBaseUrl, setQrBaseUrl] = useState('');
  const [playerQr, setPlayerQr] = useState('');
  const [liveQr, setLiveQr] = useState('');
  const [stageQr, setStageQr] = useState('');

  const playerList = Object.values(players);

  useEffect(() => {
    let host = window.location.hostname;
    let port = window.location.port;
    if ((host === 'localhost' || host === '127.0.0.1') && serverIp && serverIp !== 'localhost') {
      host = serverIp;
    }
    if (!window.location.port) {
      port = '';
    } else if (serverPort) {
      port = serverPort;
    }
    const base = `${window.location.protocol}//${host}${port ? ':' + port : ''}`;
    setQrBaseUrl(base);
  }, [serverIp, serverPort]);

  useEffect(() => {
    if (!qrBaseUrl) return;
    const playerUrl = `${qrBaseUrl}/player`;
    const liveUrl = `${qrBaseUrl}/live`;
    const stageUrl = `${qrBaseUrl}/stage`;

    QRCode.toDataURL(playerUrl, { width: 160, margin: 1 })
      .then(url => setPlayerQr(url))
      .catch(err => console.error(err));

    QRCode.toDataURL(liveUrl, { width: 160, margin: 1 })
      .then(url => setLiveQr(url))
      .catch(err => console.error(err));

    QRCode.toDataURL(stageUrl, { width: 160, margin: 1 })
      .then(url => setStageQr(url))
      .catch(err => console.error(err));
  }, [qrBaseUrl]);

  return (
    <div className="min-h-screen pb-10" style={{ background: COLORS.panelBg }}>
      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Steuerung</h1>
          <span className="text-xs font-mono" style={{ color: COLORS.inkDim }}>v{versionData.version}</span>
        </div>

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
            <div className="flex justify-center gap-3">
              <button onClick={onStop} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1" style={{ background: COLORS.panelBg2, color: COLORS.inkDim }}>
                <Square size={12} /> Stopp &amp; Schwarz
              </button>
              {songs.length > 1 && (
                <button
                  onClick={() => {
                    const currentIdx = songs.findIndex((s) => s.id === playback.songId);
                    if (currentIdx !== -1) {
                      const nextIdx = (currentIdx + 1) % songs.length;
                      onLoad(songs[nextIdx]);
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1"
                  style={{ background: COLORS.amber, color: '#241a08' }}
                >
                  Nächster Song <SkipForward size={12} />
                </button>
              )}
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
          <button onClick={onGotoOptions} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1" style={{ background: COLORS.panelBg2, color: COLORS.ink }}>
            <Settings2 size={14} /> Anzeige-Optionen
          </button>
          <button onClick={onGotoEditor} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1" style={{ background: COLORS.panelBg2, color: COLORS.ink }}>
            <Settings2 size={14} /> Songs verwalten
          </button>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onGotoProjection} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1" style={{ background: COLORS.ink, color: COLORS.stageText }}>
            <Maximize2 size={14} /> Projektion öffnen
          </button>
          <button onClick={onGotoStage} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1" style={{ background: COLORS.ink, color: COLORS.stageText }}>
            <Maximize2 size={14} /> Stageview öffnen
          </button>
        </div>

        <div className="pt-4 border-t space-y-3" style={{ borderColor: COLORS.line }}>
          {/* Player Management Section */}
          <div>
            <button
              onClick={() => setShowPlayersSection(!showPlayersSection)}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between"
              style={{ background: COLORS.panelBg2, color: COLORS.ink }}
            >
              <span className="flex items-center gap-1.5 font-bold">
                Player-Verwaltung ({playerList.length})
              </span>
              {showPlayersSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showPlayersSection && (
              <div className="mt-2 space-y-2 p-3 rounded-xl" style={{ background: COLORS.panelBg2 }}>
                {playerList.length === 0 ? (
                  <div className="text-xs italic text-center py-2" style={{ color: COLORS.inkDim }}>
                    Keine Player verbunden. Scanne den QR-Code auf ein Gerät, um sich zu verbinden.
                  </div>
                ) : (
                  playerList.map((p) => {
                    const isSelf = p.id === localPlayerId;
                    return (
                      <div key={p.id} className="p-2.5 rounded-lg bg-white shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${p.online ? 'bg-emerald-500' : 'bg-zinc-400'}`} title={p.online ? 'Online' : 'Offline'} />
                            <span className="font-mono text-xs font-bold" style={{ color: COLORS.ink }}>
                              {p.id} {isSelf && <span className="text-[10px] font-normal text-amber-600">(Dieses Gerät)</span>}
                            </span>
                          </div>
                          <button
                            onClick={() => onDeletePlayer(p.id)}
                            className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
                            title="Player entfernen"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-medium mr-1" style={{ color: COLORS.inkDim }}>Rolle:</span>
                          <button
                            onClick={() => onSetPlayerRole(p.id, 'live')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              p.role === 'live' ? 'bg-amber-500 text-black font-bold shadow-sm' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                            }`}
                          >
                            Live
                          </button>
                          <button
                            onClick={() => onSetPlayerRole(p.id, 'stage')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              p.role === 'stage' ? 'bg-amber-500 text-black font-bold shadow-sm' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                            }`}
                          >
                            Stage
                          </button>
                          <button
                            onClick={() => onSetPlayerRole(p.id, null)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              !p.role ? 'bg-zinc-700 text-white font-bold' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                          >
                            Keine
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* QR Codes Section */}
          <div>
            <button
              onClick={() => setShowQrSection(!showQrSection)}
              className="w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between"
              style={{ background: COLORS.panelBg2, color: COLORS.ink }}
            >
              <span className="flex items-center gap-1.5">
                <QrCode size={16} /> QR-Codes für Mobilgeräte
              </span>
              {showQrSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showQrSection && (
              <div className="mt-3 space-y-4 p-3 rounded-xl" style={{ background: COLORS.panelBg2 }}>
                <div className="space-y-1">
                  <label className="text-xs font-semibold block" style={{ color: COLORS.inkDim }}>
                    Ziel-URL / IP anpassen:
                  </label>
                  <input
                    type="text"
                    value={qrBaseUrl}
                    onChange={(e) => setQrBaseUrl(e.target.value)}
                    placeholder="http://192.168.1.50:8080"
                    className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-300"
                    style={{ background: '#fff', color: COLORS.ink }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col items-center p-2 bg-white rounded-lg shadow-sm">
                    <span className="text-[11px] font-bold mb-1" style={{ color: COLORS.ink }}>Player (Auto)</span>
                    {playerQr ? (
                      <img src={playerQr} alt="QR Code Player" className="w-24 h-24 object-contain" />
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center text-xs text-gray-400">Lädt...</div>
                    )}
                    <a href={`${qrBaseUrl}/player`} target="_blank" rel="noreferrer" className="text-[9px] mt-1 text-amber-600 underline truncate max-w-full">
                      /player öffnen
                    </a>
                  </div>

                  <div className="flex flex-col items-center p-2 bg-white rounded-lg shadow-sm">
                    <span className="text-[11px] font-bold mb-1" style={{ color: COLORS.ink }}>Live (Direkt)</span>
                    {liveQr ? (
                      <img src={liveQr} alt="QR Code Live" className="w-24 h-24 object-contain" />
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center text-xs text-gray-400">Lädt...</div>
                    )}
                    <a href={`${qrBaseUrl}/live`} target="_blank" rel="noreferrer" className="text-[9px] mt-1 text-amber-600 underline truncate max-w-full">
                      /live öffnen
                    </a>
                  </div>

                  <div className="flex flex-col items-center p-2 bg-white rounded-lg shadow-sm">
                    <span className="text-[11px] font-bold mb-1" style={{ color: COLORS.ink }}>Stage (Direkt)</span>
                    {stageQr ? (
                      <img src={stageQr} alt="QR Code Stage" className="w-24 h-24 object-contain" />
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center text-xs text-gray-400">Lädt...</div>
                    )}
                    <a href={`${qrBaseUrl}/stage`} target="_blank" rel="noreferrer" className="text-[9px] mt-1 text-amber-600 underline truncate max-w-full">
                      /stage öffnen
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
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
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const update = (patch) => onChange({ ...song, ...patch });
  const updateLine = (id, patch) => update({ lines: song.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLine = () => update({ lines: [...song.lines, { id: uid(), en: '', de: '', mode: 'sec', timeSec: 0, beat: '', duration: '' }] });
  const removeLine = (id) => update({ lines: song.lines.filter((l) => l.id !== id) });
  const moveLine = (id, dir) => {
    const idx = song.lines.findIndex((l) => l.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= song.lines.length) return;
    const next = [...song.lines];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    update({ lines: next });
  };

  const computedLines = computeLinesWithTimes(song);

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
          className="flex-1 min-w-[150px] px-3 py-2 rounded-lg text-sm font-semibold"
          style={{ background: COLORS.panelBg2, color: COLORS.ink }}
        />
        <div className="flex items-center gap-1.5 shrink-0 rounded-lg p-1" style={{ background: COLORS.panelBg2 }}>
          <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>BPM</span>
          <input
            type="number"
            value={song.bpm}
            onChange={(e) => update({ bpm: Number(e.target.value) || 1 })}
            placeholder="BPM"
            className="w-16 px-1.5 py-1 rounded text-sm bg-white"
            style={{ color: COLORS.ink }}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0 rounded-lg p-1" style={{ background: COLORS.panelBg2 }}>
          <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>Taktart</span>
          <select
            value={`${song.timeSigNum || 4}/${song.timeSigDen || 4}`}
            onChange={(e) => {
              const [num, den] = e.target.value.split('/');
              update({ timeSigNum: Number(num), timeSigDen: Number(den) });
            }}
            className="px-1.5 py-1 rounded text-sm bg-white cursor-pointer"
            style={{ color: COLORS.ink }}
          >
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="2/4">2/4</option>
            <option value="6/8">6/8</option>
            <option value="5/4">5/4</option>
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
      <div className="rounded-xl p-3 space-y-3" style={{ background: COLORS.panelBg2 }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Music size={18} style={{ color: COLORS.ink }} />
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>
              MP3 Audio-Datei
            </span>
            {song.audioName && (
              <span className="text-xs px-2 py-0.5 rounded bg-white font-mono truncate max-w-xs" style={{ color: COLORS.ink }}>
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
          <WaveformEditor song={song} computedLines={computedLines} onUpdateSong={update} />
        ) : (
          <div className="p-4 text-center border-2 border-dashed rounded-lg text-xs" style={{ borderColor: COLORS.line, color: COLORS.inkDim }}>
            Keine MP3-Datei verknüpft. Lade eine MP3 hoch, um die interaktive Wellenform mit Zeitstempel-Markern zu nutzen.
          </div>
        )}
      </div>

      {/* Lyric Line Textfields */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.inkDim }}>
          Songzeilen &amp; Marker-Zeitstempel
        </div>
        {song.lines.map((l) => {
          const computedLine = computedLines.find((cl) => cl.id === l.id);
          const t = computedLine ? computedLine.t : 0;
          return (
            <div key={l.id} className="rounded-lg p-2 space-y-1" style={{ background: COLORS.panelBg2 }}>
              <input value={l.en} onChange={(e) => updateLine(l.id, { en: e.target.value })} placeholder="Englisch (Haupttext)" className="w-full px-2 py-1 rounded text-sm" style={{ background: '#fff', color: COLORS.ink }} />
              <input value={l.de} onChange={(e) => updateLine(l.id, { de: e.target.value })} placeholder="Deutsch (Übersetzung)" className="w-full px-2 py-1 rounded text-sm" style={{ background: '#fff', color: COLORS.ink }} />
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <select value={l.mode} onChange={(e) => updateLine(l.id, { mode: e.target.value })} className="px-1.5 py-1 rounded bg-white text-xs border border-gray-200" style={{ color: COLORS.ink }}>
                  <option value="sec">Absolut (Sekunden)</option>
                  <option value="relative">Relativ (s seit letzter)</option>
                  <option value="bar_beat">Takt / Schlag</option>
                  <option value="beat">Schlag absolut</option>
                  <option value="relative_bar_beat">Relativ (Takt / Schlag)</option>
                </select>

                {l.mode === 'sec' && (
                  <div className="flex items-center gap-1">
                    <span style={{ color: COLORS.inkDim }}>s:</span>
                    <input type="number" step="0.1" value={l.timeSec !== undefined && l.timeSec !== null ? l.timeSec : ''} onChange={(e) => updateLine(l.id, { timeSec: e.target.value })} className="w-16 px-1.5 py-1 rounded bg-white border border-gray-200" />
                  </div>
                )}

                {l.mode === 'relative' && (
                  <div className="flex items-center gap-1">
                    <span style={{ color: COLORS.inkDim }}>+s:</span>
                    <input type="number" step="0.1" value={l.relativeSec !== undefined && l.relativeSec !== null ? l.relativeSec : ''} onChange={(e) => updateLine(l.id, { relativeSec: e.target.value })} className="w-16 px-1.5 py-1 rounded bg-white border border-gray-200" />
                  </div>
                )}

                {l.mode === 'relative_bar_beat' && (
                  <div className="flex items-center gap-1">
                    <span style={{ color: COLORS.inkDim }}>+Takt:</span>
                    <input type="number" step="1" value={l.relativeBar !== undefined && l.relativeBar !== null ? l.relativeBar : ''} onChange={(e) => updateLine(l.id, { relativeBar: e.target.value })} className="w-12 px-1.5 py-1 rounded bg-white border border-gray-200" />
                    <span style={{ color: COLORS.inkDim }}>+Schlag:</span>
                    <input type="number" step="1" value={l.relativeBeat !== undefined && l.relativeBeat !== null ? l.relativeBeat : ''} onChange={(e) => updateLine(l.id, { relativeBeat: e.target.value })} className="w-12 px-1.5 py-1 rounded bg-white border border-gray-200" />
                  </div>
                )}

                {(l.mode === 'bar_beat' || !l.mode) && (
                  <div className="flex items-center gap-1">
                    <span style={{ color: COLORS.inkDim }}>Takt:</span>
                    <input type="number" step="1" min="1" value={l.bar !== undefined && l.bar !== null ? l.bar : 1} onChange={(e) => updateLine(l.id, { bar: e.target.value })} className="w-12 px-1.5 py-1 rounded bg-white border border-gray-200" />
                    <span style={{ color: COLORS.inkDim }}>Schlag:</span>
                    <input type="number" step="1" min="1" max={song.timeSigNum || 4} value={l.beat !== undefined && l.beat !== null ? l.beat : 1} onChange={(e) => updateLine(l.id, { beat: e.target.value })} className="w-12 px-1.5 py-1 rounded bg-white border border-gray-200" />
                  </div>
                )}

                {l.mode === 'beat' && (
                  <div className="flex items-center gap-1">
                    <span style={{ color: COLORS.inkDim }}>Schlag:</span>
                    <input type="number" step="1" min="1" value={l.beat !== undefined && l.beat !== null ? l.beat : 1} onChange={(e) => updateLine(l.id, { beat: e.target.value })} className="w-16 px-1.5 py-1 rounded bg-white border border-gray-200" />
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <span style={{ color: COLORS.inkDim }} title="Anzeigedauer in Sekunden">Dauer (s):</span>
                  <input type="number" step="0.1" min="0" placeholder="∞" value={l.duration !== undefined && l.duration !== null ? l.duration : ''} onChange={(e) => updateLine(l.id, { duration: e.target.value })} className="w-14 px-1.5 py-1 rounded bg-white border border-gray-200" />
                </div>

                <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>≈ {fmtTime(t)}</span>

                <div className="flex gap-1 ml-auto">
                  <button onClick={() => moveLine(l.id, -1)} aria-label="Zeile nach oben" className="p-1 rounded hover:bg-black/10 bg-white"><ChevronUp size={14} /></button>
                  <button onClick={() => moveLine(l.id, 1)} aria-label="Zeile nach unten" className="p-1 rounded hover:bg-black/10 bg-white"><ChevronDown size={14} /></button>
                  <button onClick={() => removeLine(l.id)} aria-label="Zeile löschen" className="p-1 rounded hover:bg-black/10 bg-white"><Trash2 size={14} color={COLORS.danger} /></button>
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

  const moveSong = (id, direction) => {
    const index = songs.findIndex((s) => s.id === id);
    if (index === -1) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= songs.length) return;
    const updated = [...songs];
    const [moved] = updated.splice(index, 1);
    updated.splice(nextIndex, 0, moved);
    onChangeSongs(updated);
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.panelBg }}>
      <div className="max-w-[1800px] w-full mx-auto p-4 md:px-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Songs verwalten</h1>
          <button onClick={onBack} className="text-sm px-3 py-1.5 rounded-lg" style={{ background: COLORS.panelBg2, color: COLORS.ink }}>Zur Steuerung</button>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-64 shrink-0 space-y-2">
            {songs.map((s, index) => (
              <div
                key={s.id}
                className="flex items-center gap-1 w-full rounded-lg pr-1"
                style={{ background: s.id === selectedId ? COLORS.amber : COLORS.panelBg2 }}
              >
                <button
                  onClick={() => setSelectedId(s.id)}
                  className="flex-1 text-left px-3 py-2 text-sm font-medium truncate"
                  style={{ color: s.id === selectedId ? '#241a08' : COLORS.ink }}
                >
                  {s.title}
                </button>
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSong(s.id, -1); }}
                    disabled={index === 0}
                    className="p-0.5 hover:bg-black/10 rounded disabled:opacity-30"
                    title="Nach oben verschieben"
                  >
                    <ChevronUp size={14} color={s.id === selectedId ? '#241a08' : COLORS.ink} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSong(s.id, 1); }}
                    disabled={index === songs.length - 1}
                    className="p-0.5 hover:bg-black/10 rounded disabled:opacity-30"
                    title="Nach unten verschieben"
                  >
                    <ChevronDown size={14} color={s.id === selectedId ? '#241a08' : COLORS.ink} />
                  </button>
                </div>
              </div>
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
  const [view, setView] = useState(() => {
    const path = window.location.pathname;
    if (path === '/live') return 'projection';
    if (path === '/stage') return 'stage';
    if (path === '/player') return 'player';
    return 'control';
  });

  const {
    songs,
    playback,
    players,
    connected,
    playerId,
    sendSongs,
    sendPlayback,
    sendPlayerRole,
    sendDeletePlayer,
    serverIp,
    serverPort
  } = useSyncedState();
  const elapsed = useElapsed(playback);

  const localPlayer = players[playerId] || null;

  // Sync state view changes with the browser URL (via history pushState)
  const changeView = (nextView) => {
    setView(nextView);
    if (nextView === 'projection') {
      window.history.pushState(null, '', '/live');
    } else if (nextView === 'stage') {
      window.history.pushState(null, '', '/stage');
    } else if (nextView === 'player') {
      window.history.pushState(null, '', '/player');
    } else if (nextView === 'control') {
      window.history.pushState(null, '', '/');
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/live') setView('projection');
      else if (path === '/stage') setView('stage');
      else if (path === '/player') setView('player');
      else setView('control');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      {view === 'player' ? (
        localPlayer && localPlayer.role === 'live' ? (
          <ProjectionView songs={songs} playback={playback} elapsed={elapsed} onExit={() => changeView('control')} connected={connected} />
        ) : localPlayer && localPlayer.role === 'stage' ? (
          <StageView songs={songs} playback={playback} elapsed={elapsed} onExit={() => changeView('control')} />
        ) : (
          <UnassignedPlayerView playerId={playerId} />
        )
      ) : view === 'projection' ? (
        <ProjectionView songs={songs} playback={playback} elapsed={elapsed} onExit={() => changeView('control')} connected={connected} />
      ) : view === 'stage' ? (
        <StageView songs={songs} playback={playback} elapsed={elapsed} onExit={() => changeView('control')} />
      ) : view === 'editor' ? (
        <EditorView songs={songs} onChangeSongs={sendSongs} onBack={() => changeView('control')} />
      ) : view === 'options' ? (
        <OptionsView playback={playback} onChangePlayback={(patch) => sendPlayback({ ...playback, ...patch })} onBack={() => changeView('control')} />
      ) : (
        <ControlView
          songs={songs}
          playback={playback}
          players={players}
          localPlayerId={playerId}
          onSetPlayerRole={sendPlayerRole}
          onDeletePlayer={sendDeletePlayer}
          elapsed={elapsed}
          serverIp={serverIp}
          serverPort={serverPort}
          onLoad={loadSong}
          onTogglePlay={togglePlay}
          onStop={stopSong}
          onSeek={seekTo}
          onNudge={nudge}
          onChangePlayback={(patch) => sendPlayback({ ...playback, ...patch })}
          onGotoEditor={() => setView('editor')}
          onGotoProjection={() => changeView('projection')}
          onGotoOptions={() => setView('options')}
          onGotoStage={() => changeView('stage')}
        />
      )}
    </>
  );
}
