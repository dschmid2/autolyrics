import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Rewind, FastForward, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Trash2, Maximize2, X, Settings2, Copy, Check, WifiOff, Upload, ZoomIn, ZoomOut, Music, Clock, Tablet, Sliders, MonitorPlay, Tv, Eye, QrCode, Sun, Moon } from 'lucide-react';
import versionData from './version.json';

const THEME_PALETTES = {
  light: {
    panelBg: '#F4EFE4',
    panelBg2: '#E9E1CE',
    cardBg: '#FFFFFF',
    inputBg: '#FFFFFF',
    ink: '#221F1A',
    inkDim: '#6B6558',
    amber: '#D89A3E',
    line: '#D8CFBB',
    danger: '#B5453A',
    stageBg: '#0A0A0D',
    stageText: '#F4EFE4',
    stageTextDim: '#9AA0AE',
  },
  dark: {
    panelBg: '#121215',
    panelBg2: '#1C1C22',
    cardBg: '#18181F',
    inputBg: '#24242D',
    ink: '#EDEAE4',
    inkDim: '#9AA0AE',
    amber: '#D89A3E',
    line: '#2E2E38',
    danger: '#E05A4C',
    stageBg: '#0A0A0D',
    stageText: '#F4EFE4',
    stageTextDim: '#9AA0AE',
  },
};

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
  colors: THEME_PALETTES.light,
});

function useTheme() {
  return useContext(ThemeContext);
}

// Global fallback for any un-contexted reference
const COLORS = THEME_PALETTES.light;
const LEGACY_COLORS = {
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

function parsePlaintextSongLines(plaintext) {
  if (!plaintext) return [];
  const rawLines = plaintext.split(/\r?\n/);
  const lines = [];
  let barIndex = 1;

  for (let i = 0; i < rawLines.length; i++) {
    let lineStr = rawLines[i].trim();
    if (!lineStr) continue;

    let stageOnly = false;
    if (lineStr.startsWith('*')) {
      stageOnly = true;
      lineStr = lineStr.slice(1).trim();
    }

    let comment = '';
    const bracketMatch = lineStr.match(/^\[(.*?)\]\s*(.*)$/);
    if (bracketMatch) {
      comment = bracketMatch[1].trim();
      lineStr = bracketMatch[2].trim();
    }

    if (!stageOnly && lineStr.startsWith('*')) {
      stageOnly = true;
      lineStr = lineStr.slice(1).trim();
    }

    lines.push({
      id: uid(),
      en: lineStr,
      de: '',
      mode: 'bar_beat',
      bar: barIndex,
      beat: 1,
      duration: '',
      stageOnly,
      comment,
    });
    barIndex++;
  }
  return lines;
}

function generateGuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreatePlayerId() {
  try {
    let id = localStorage.getItem('autolyrics_player_id');
    if (!id) {
      id = generateGuid();
      localStorage.setItem('autolyrics_player_id', id);
    }
    return id;
  } catch (e) {
    return generateGuid();
  }
}

function getBarBeat(time, bpm = 90, timeSigNum = 4) {
  const safeBpm = Number(bpm) || 90;
  const safeTimeSig = Number(timeSigNum) || 4;
  const beats = Math.max(0, time * (safeBpm / 60));
  const bar = Math.floor(beats / safeTimeSig + 1e-4) + 1;
  const beat = Math.floor((beats + 1e-4) % safeTimeSig) + 1;
  return { bar, beat };
}

function computeLinesWithTimes(song) {
  if (!song || !Array.isArray(song.lines)) return [];
  const bpm = Number(song.bpm) || 90;
  const timeSigNum = Number(song.timeSigNum) || 4;
  const lines = [];
  let prevTime = 0;
  const defaultMode = song?.timingMode || 'bar_beat';

  for (let i = 0; i < song.lines.length; i++) {
    const l = song.lines[i];
    const mode = l.mode || defaultMode;
    let t = 0;
    let bar = l.bar !== undefined && l.bar !== null ? Number(l.bar) : undefined;
    let beat = l.beat !== undefined && l.beat !== null ? Number(l.beat) : undefined;

    if (mode === 'sec') {
      t = Number(l.timeSec) || 0;
    } else if (mode === 'relative') {
      const rel = Number(l.relativeSec) || 0;
      t = prevTime + rel;
    } else if (mode === 'relative_bar_beat') {
      const relBar = Number(l.relativeBar) || 0;
      const relBeat = Number(l.relativeBeat) || 0;
      const totalBeats = relBar * timeSigNum + relBeat;
      t = prevTime + totalBeats * (60 / bpm);
    } else if (mode === 'bar_beat') {
      bar = Number(l.bar) || 1;
      beat = Number(l.beat) || 1;
      const totalBeats = (bar - 1) * timeSigNum + (beat - 1);
      t = Math.max(0, totalBeats * (60 / bpm));
    } else if (mode === 'beat') {
      beat = Number(l.beat) || 1;
      t = Math.max(0, (beat - 1) * 60 / bpm);
    } else {
      t = Number(l.timeSec) || 0;
    }

    if (bar === undefined || beat === undefined || mode !== 'bar_beat') {
      const bb = getBarBeat(t, bpm, timeSigNum);
      bar = bb.bar;
      beat = bb.beat;
    }

    const duration = l.duration !== undefined && l.duration !== null && l.duration !== '' ? Number(l.duration) : null;
    lines.push({ ...l, mode, t, duration, bar, beat });
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
  const mode = line.mode || song?.timingMode || 'bar_beat';
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

function WaveformEditor({ song, computedLines, onUpdateSong, onPlaybackStateChange, seekRef, playback, sendPlayback }) {
  const { audioBuffer, loading, error } = useAudioBuffer(song.audioUrl);
  const audioRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  const [sendToScreens, setSendToScreens] = useState(false);
  const sendToScreensRef = useRef(false);
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
      if (!isPlayingRef.current) return;
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      setCurrentTime((prev) => {
        if (!isPlayingRef.current) return prev;
        const nextSongTime = Math.max(0, prev + delta);
        const targetAudioTime = nextSongTime - audioOffset;

        if (audioRef.current && audioBuffer) {
          if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
            if (audioRef.current.paused && isPlayingRef.current) {
              audioRef.current.currentTime = targetAudioTime;
              audioRef.current.play().catch(() => {});
            } else if (!audioRef.current.paused) {
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

        if (containerRef.current && !isDragging) {
          const container = containerRef.current;
          const headX = nextSongTime * pxPerSec;
          const targetScrollLeft = headX - container.clientWidth / 2;
          container.scrollLeft = Math.max(0, targetScrollLeft);
        }

        currentTimeRef.current = nextSongTime;
        return nextSongTime;
      });

      if (isPlayingRef.current) {
        animId = requestAnimationFrame(update);
      }
    };

    if (isPlaying) {
      lastTickRef.current = Date.now();
      animId = requestAnimationFrame(update);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, audioOffset, audioBuffer, audioDuration, isDragging, pxPerSec]);

  // Keep latest refs for callbacks to avoid stale closures
  const playbackRef = useRef(playback);
  useEffect(() => { playbackRef.current = playback; }, [playback]);
  const songRef = useRef(song);
  useEffect(() => { songRef.current = song; }, [song]);

  const syncScreens = useCallback((status, timeSec) => {
    if (!sendToScreensRef.current || !sendPlayback) return;
    const elapsed = timeSec !== undefined ? timeSec : currentTimeRef.current;
    sendPlayback({
      ...(playbackRef.current || {}),
      songId: songRef.current.id,
      status,
      anchorElapsed: Math.max(0, elapsed),
      anchorEpoch: Date.now(),
    });
  }, [sendPlayback]);

  useEffect(() => {
    return () => {
      // If sendToScreens was active when component unmounts, stop screens
      if (sendToScreensRef.current && sendPlayback && playbackRef.current) {
        sendPlayback({
          ...playbackRef.current,
          songId: songRef.current.id,
          status: 'stopped',
          anchorElapsed: 0,
          anchorEpoch: Date.now(),
        });
      }
    };
  }, [sendPlayback]);

  const toggleSendToScreens = () => {
    const nextVal = !sendToScreens;
    setSendToScreens(nextVal);
    sendToScreensRef.current = nextVal;
    if (sendPlayback) {
      if (nextVal) {
        syncScreens(isPlayingRef.current ? 'playing' : 'paused', currentTimeRef.current);
      } else {
        sendPlayback({
          ...(playbackRef.current || {}),
          songId: songRef.current.id,
          status: 'stopped',
          anchorElapsed: 0,
          anchorEpoch: Date.now(),
        });
      }
    }
  };

  const togglePlay = () => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      syncScreens('paused', currentTimeRef.current);
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      const targetAudioTime = currentTime - audioOffset;
      if (audioRef.current && audioBuffer && targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        audioRef.current.currentTime = targetAudioTime;
        audioRef.current.play().catch(() => {});
      }
      syncScreens('playing', currentTimeRef.current);
    }
  };

  const stopAudio = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
    setCurrentTime(0);
    currentTimeRef.current = 0;
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
    syncScreens('stopped', 0);
  };

  const seekToTime = useCallback((timeSec) => {
    const clampedTime = Math.max(0, Math.min(totalDuration, timeSec));
    setCurrentTime(clampedTime);
    currentTimeRef.current = clampedTime;
    const targetAudioTime = clampedTime - audioOffset;
    if (audioRef.current && audioBuffer) {
      if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        audioRef.current.currentTime = targetAudioTime;
      } else {
        audioRef.current.pause();
      }
    }
    if (containerRef.current) {
      const container = containerRef.current;
      const headX = clampedTime * pxPerSec;
      container.scrollLeft = Math.max(0, headX - container.clientWidth / 2);
    }
    syncScreens(isPlayingRef.current ? 'playing' : 'paused', clampedTime);
  }, [totalDuration, audioOffset, audioBuffer, audioDuration, pxPerSec, syncScreens]);

  useEffect(() => {
    if (seekRef) {
      seekRef.current = seekToTime;
    }
  }, [seekRef, seekToTime]);

  const seekNudge = (delta) => {
    seekToTime(currentTime + delta);
  };

  const addMarkerAtCurrentTime = () => {
    const t = Math.round(currentTime * 100) / 100;
    const defaultMode = song.timingMode || 'bar_beat';
    let timingPatch = { mode: defaultMode };

    if (defaultMode === 'bar_beat') {
      const totalBeats = Math.max(0, t * (bpm / 60));
      const bar = Math.floor(totalBeats / timeSigNum) + 1;
      const beat = Math.floor(totalBeats % timeSigNum) + 1;
      timingPatch = { mode: 'bar_beat', bar, beat };
    } else {
      timingPatch = { mode: 'sec', timeSec: t };
    }

    const newLine = {
      id: uid(),
      en: '',
      de: '',
      duration: '',
      ...timingPatch
    };
    onUpdateSong({ lines: [...song.lines, newLine] });
  };

  const totalBeats = currentTime * (bpm / 60);
  const currentBar = Math.floor(totalBeats / timeSigNum) + 1;
  const currentBeat = Math.floor(totalBeats % timeSigNum) + 1;

  const activeIdx = currentIndex(computedLines, currentTime);
  const activeLine = activeIdx >= 0 ? computedLines[activeIdx] : null;

  useEffect(() => {
    if (onPlaybackStateChange) {
      onPlaybackStateChange({
        isPlaying,
        currentTime,
        activeIdx,
        activeLineId: activeLine ? activeLine.id : null,
      });
    }
  }, [onPlaybackStateChange, isPlaying, currentTime, activeIdx, activeLine]);

  const handleContainerClick = (e) => {
    if (isDragging) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const seekTime = Math.max(0, Math.min(totalDuration, x / pxPerSec));
    seekToTime(seekTime);
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
        onEnded={() => {
          isPlayingRef.current = false;
          setIsPlaying(false);
          syncScreens('stopped', 0);
        }}
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

          <button
            onClick={toggleSendToScreens}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
              sendToScreens
                ? 'bg-amber-500 text-black border-amber-400 font-semibold shadow-sm'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-700'
            }`}
            title="Texte während des MP3-Playbacks live an Stage- und Projection-Screens senden"
          >
            <Tv size={14} className={sendToScreens ? 'text-black' : 'text-zinc-400'} />
            <span>Send to screens</span>
          </button>
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
    stageFontSize: 64,
    translationPercent: 60,
    translationSpacing: 24,
    positionX: 50,
    positionY: 50,
    liveWidthPercent: 100,
    liveTextAlign: 'center',
    showHeartbeat: true,
    stagePastLines: 2,
    stageFutureLines: 2,
    stageLeadSeconds: 0,
    stageCommentWidthPercent: 20,
    stageLineSpacing: 24,
    stagePositionY: 0
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

function useLineIndex(lines, playback, leadSeconds = 0) {
  const getIndex = () => {
    if (!lines || !lines.length) return -1;
    const el = computeElapsed(playback) + leadSeconds;
    return currentIndex(lines, el);
  };

  const [idx, setIdx] = useState(getIndex);

  useEffect(() => {
    setIdx(getIndex());
    if (playback.status !== 'playing' || !lines || !lines.length) return;

    const iv = setInterval(() => {
      const nextIdx = getIndex();
      setIdx((prev) => (prev !== nextIdx ? nextIdx : prev));
    }, 100);
    return () => clearInterval(iv);
  }, [playback, lines, leadSeconds]);

  return idx;
}

function useSongCompleted(lines, playback) {
  const checkCompleted = () => {
    if (!lines || !lines.length) return false;
    const dur = getSongDuration(lines);
    return computeElapsed(playback) >= dur;
  };

  const [completed, setCompleted] = useState(checkCompleted);

  useEffect(() => {
    setCompleted(checkCompleted());
    if (playback.status !== 'playing' || !lines || !lines.length) return;

    const iv = setInterval(() => {
      const nextCompleted = checkCompleted();
      setCompleted((prev) => (prev !== nextCompleted ? nextCompleted : prev));
    }, 200);
    return () => clearInterval(iv);
  }, [playback, lines]);

  return completed;
}


// --- Views ------------------------------------------------------------------

function OptionsView({ playback, onChangePlayback }) {
  const { colors: COLORS, theme, setTheme } = useTheme();
  const fontSize = playback.fontSize !== undefined ? playback.fontSize : 64;
  const translationPercent = playback.translationPercent !== undefined ? playback.translationPercent : 60;
  const translationSpacing = playback.translationSpacing !== undefined ? playback.translationSpacing : 24;
  const positionX = playback.positionX !== undefined ? playback.positionX : 50;
  const positionY = playback.positionY !== undefined ? playback.positionY : 50;
  const liveWidthPercent = playback.liveWidthPercent !== undefined ? playback.liveWidthPercent : 100;
  const liveTextAlign = playback.liveTextAlign || 'center';
  const showHeartbeat = playback.showHeartbeat !== undefined ? playback.showHeartbeat : true;
  const stagePastLines = playback.stagePastLines !== undefined ? playback.stagePastLines : 2;
  const stageFutureLines = playback.stageFutureLines !== undefined ? playback.stageFutureLines : 2;
  const stageLeadSeconds = playback.stageLeadSeconds !== undefined ? playback.stageLeadSeconds : 0;
  const stagePositionY = playback.stagePositionY !== undefined ? playback.stagePositionY : 0;

  return (
    <div className="min-h-screen pb-10" style={{ background: COLORS.panelBg }}>
      <div className="max-w-[1200px] w-full mx-auto p-4 md:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Anzeige-Optionen</h1>
            <p className="text-xs" style={{ color: COLORS.inkDim }}>
              Einstellungen für Projektion (Live-View), Bühnenanzeige (Stageview) und Darstellung.
            </p>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-xl border self-start sm:self-auto" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'light'
                  ? 'bg-amber text-zinc-950 font-bold shadow-sm'
                  : 'hover:opacity-100 opacity-80'
              }`}
              style={{
                background: theme === 'light' ? COLORS.amber : 'transparent',
                color: theme === 'light' ? '#241a08' : COLORS.ink,
              }}
            >
              <Sun size={14} />
              <span>Hell</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-amber text-zinc-950 font-bold shadow-sm'
                  : 'hover:opacity-100 opacity-80'
              }`}
              style={{
                background: theme === 'dark' ? COLORS.amber : 'transparent',
                color: theme === 'dark' ? '#241a08' : COLORS.ink,
              }}
            >
              <Moon size={14} />
              <span>Dunkel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Card 1: Live-View (Projektion) */}
          <div className="rounded-2xl p-5 space-y-4 shadow-sm" style={{ background: COLORS.panelBg2 }}>
            <div className="border-b pb-2 flex items-center justify-between" style={{ borderColor: COLORS.line }}>
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: COLORS.ink }}>
                Projektion (Live-View)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-black/5" style={{ color: COLORS.inkDim }}>
                /live
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Schriftgrösse Projektion</span>
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

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Abstand zwischen Text und Übersetzung</span>
                <span className="font-mono">{translationSpacing}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={translationSpacing}
                onChange={(e) => onChangePlayback({ translationSpacing: Number(e.target.value) })}
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

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Breite Bildbereich</span>
                <span className="font-mono">{liveWidthPercent}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={liveWidthPercent}
                onChange={(e) => onChangePlayback({ liveWidthPercent: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs" style={{ color: COLORS.inkDim }}>
                <span>Textausrichtung</span>
              </div>
              <div className="flex gap-2 pt-1">
                {[
                  { value: 'left', label: 'Links' },
                  { value: 'center', label: 'Mittig' },
                  { value: 'right', label: 'Rechts' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangePlayback({ liveTextAlign: value })}
                    className={`flex-1 py-1.5 px-3 text-xs rounded-lg font-medium transition-colors ${
                      liveTextAlign === value
                        ? 'bg-amber text-zinc-950 font-bold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: COLORS.line }}>
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
          </div>

          {/* Card 2: Stage-View (Bühnenanzeige) */}
          <div className="rounded-2xl p-5 space-y-4 shadow-sm" style={{ background: COLORS.panelBg2 }}>
            <div className="border-b pb-2 flex items-center justify-between" style={{ borderColor: COLORS.line }}>
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: COLORS.ink }}>
                Bühnenanzeige (Stage-View)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-black/5" style={{ color: COLORS.inkDim }}>
                /stage
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Schriftgrösse Stage-View</span>
                <span className="font-mono">{playback.stageFontSize !== undefined ? playback.stageFontSize : 64}px</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                value={playback.stageFontSize !== undefined ? playback.stageFontSize : 64}
                onChange={(e) => onChangePlayback({ stageFontSize: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Zeilenabstand Stage-View</span>
                <span className="font-mono">{playback.stageLineSpacing !== undefined ? playback.stageLineSpacing : 24}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={playback.stageLineSpacing !== undefined ? playback.stageLineSpacing : 24}
                onChange={(e) => onChangePlayback({ stageLineSpacing: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Vertikale Position Stage-View</span>
                <span className="font-mono">{stagePositionY > 0 ? `+${stagePositionY}` : stagePositionY}%</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={stagePositionY}
                onChange={(e) => onChangePlayback({ stagePositionY: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

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

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Breite Kommentarspalte (Stage-View)</span>
                <span className="font-mono">{playback.stageCommentWidthPercent !== undefined ? playback.stageCommentWidthPercent : 20}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={playback.stageCommentWidthPercent !== undefined ? playback.stageCommentWidthPercent : 20}
                onChange={(e) => onChangePlayback({ stageCommentWidthPercent: Number(e.target.value) })}
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none cursor-none" style={{ background: COLORS.stageBg, color: COLORS.stageText }}>
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

function StageView({ songs, playback, onExit }) {
  const song = useMemo(() => songs.find((s) => s.id === playback.songId) || null, [songs, playback.songId]);
  const lines = useMemo(() => (song ? sortedLines(song) : []), [song]);
  const stageLeadSeconds = playback.stageLeadSeconds !== undefined ? playback.stageLeadSeconds : 0;
  const stagePastLines = playback.stagePastLines !== undefined ? playback.stagePastLines : 2;
  const stageFutureLines = playback.stageFutureLines !== undefined ? playback.stageFutureLines : 2;
  const stageLineSpacing = playback.stageLineSpacing !== undefined ? playback.stageLineSpacing : 24;
  const stagePositionY = playback.stagePositionY !== undefined ? playback.stagePositionY : 0;
  const idx = useLineIndex(lines, playback, stageLeadSeconds);
  const currentIdx = idx >= 0 ? idx : 0;

  const stageFontSize = playback.stageFontSize !== undefined ? playback.stageFontSize : 64;
  const showHeartbeat = playback.showHeartbeat !== undefined ? playback.showHeartbeat : true;
  const commentPercent = playback.stageCommentWidthPercent !== undefined ? playback.stageCommentWidthPercent : 20;

  const pulseDuration = song ? 60 / (song.bpm || 60) : 1;
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const [activeCenterOffset, setActiveCenterOffset] = useState(0);

  const requestFs = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const lineRowHeight = Math.max(20, Math.round(stageFontSize * 1.2 + stageLineSpacing));

  const startIndex = Math.max(0, currentIdx - stagePastLines - 1);
  const endIndex = Math.min(lines.length - 1, currentIdx + stageFutureLines + 1);

  // Dynamically compute the vertical center of the active line row so wrapped lines push subsequent lines down
  useEffect(() => {
    const updateOffset = () => {
      const activeEl = lineRefs.current[currentIdx];
      if (activeEl) {
        const lineTop = activeEl.offsetTop;
        const lineHeight = activeEl.offsetHeight;
        setActiveCenterOffset(lineTop + lineHeight / 2);
      } else {
        setActiveCenterOffset((currentIdx + 0.5) * lineRowHeight);
      }
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, [currentIdx, lines, stageFontSize, commentPercent, lineRowHeight, startIndex, endIndex]);

  const topSpacerHeight = startIndex > 0 ? startIndex * lineRowHeight : 0;
  const bottomSpacerHeight = lines.length > 0 && endIndex < lines.length - 1
    ? (lines.length - 1 - endIndex) * lineRowHeight
    : 0;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 select-none cursor-none flex flex-col justify-center items-center px-6 overflow-hidden"
      style={{ background: COLORS.stageBg }}
    >
      <div className="relative w-full h-full overflow-hidden">
        {/* Durchgehende vertikale Trennlinie */}
        {commentPercent > 0 && commentPercent < 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-zinc-800 z-10 pointer-events-none opacity-60"
            style={{ left: `${commentPercent}%` }}
          />
        )}

        {/* Animated scrolling container */}
        <div
          className="w-full absolute left-0 flex flex-col items-center transition-transform duration-500 ease-out"
          style={{
            top: `${50 + stagePositionY}%`,
            transform: `translateY(-${activeCenterOffset || (currentIdx + 0.5) * lineRowHeight}px)`
          }}
        >
          {lines.length === 0 ? (
            <div
              style={{
                color: COLORS.stageTextDim,
                fontFamily: 'Gelasio, Georgia, "Iowan Old Style", ui-serif, serif',
                fontSize: `${stageFontSize * 0.75}px`
              }}
              className="text-center opacity-40"
            >
              — Kein Song geladen —
            </div>
          ) : (
            <>
              {topSpacerHeight > 0 && (
                <div style={{ height: `${topSpacerHeight}px` }} className="w-full shrink-0" aria-hidden="true" />
              )}
              {lines.slice(startIndex, endIndex + 1).map((l, sliceIdx) => {
                const i = startIndex + sliceIdx;
                const isCurrent = i === currentIdx;
                const isPast = i < currentIdx;
                const isVisible = i >= currentIdx - stagePastLines && i <= currentIdx + stageFutureLines;

                if (commentPercent === 0) {
                  return (
                    <div
                      key={l.id}
                      ref={(el) => { lineRefs.current[i] = el; }}
                      style={{
                        minHeight: `${lineRowHeight}px`
                      }}
                      className={`flex items-center w-full justify-start shrink-0 py-2 transition-opacity duration-500 ${
                        !isVisible ? 'opacity-0 pointer-events-none' : ''
                      }`}
                    >
                      <div
                        style={{
                          color: isCurrent ? COLORS.stageText : COLORS.stageTextDim,
                          fontFamily: 'Gelasio, Georgia, "Iowan Old Style", ui-serif, serif',
                          fontSize: `${stageFontSize}px`,
                          lineHeight: '1.2'
                        }}
                        className={`text-left font-bold transition-opacity duration-500 ${
                          !isVisible ? 'opacity-0' : isCurrent ? 'opacity-100' : isPast ? 'opacity-25' : 'opacity-40'
                        }`}
                      >
                        {l.en}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={l.id}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    style={{
                      minHeight: `${lineRowHeight}px`,
                      gridTemplateColumns: `${commentPercent}% 1fr`
                    }}
                    className={`grid items-start w-full shrink-0 py-2 transition-opacity duration-500 ${
                      !isVisible ? 'opacity-0 pointer-events-none' : ''
                    }`}
                  >
                    {/* Left Column: Comment (Right-aligned, wraps without truncation, uniform bold font weight, top-aligned) */}
                    <div
                      style={{
                        color: isCurrent ? COLORS.amber : COLORS.stageTextDim,
                        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                        fontSize: `${stageFontSize * 0.5}px`,
                        lineHeight: '1.2'
                      }}
                      className={`text-right font-bold pr-4 md:pr-6 break-words min-w-0 transition-opacity duration-500 ${
                        !isVisible ? 'opacity-0' : isCurrent ? 'opacity-100' : isPast ? 'opacity-25' : 'opacity-40'
                      }`}
                    >
                      {l.comment || ''}
                    </div>

                    {/* Right Column: Lyrics (Left-aligned, always bold) */}
                    <div
                      style={{
                        color: isCurrent ? COLORS.stageText : COLORS.stageTextDim,
                        fontFamily: 'Gelasio, Georgia, "Iowan Old Style", ui-serif, serif',
                        fontSize: `${stageFontSize}px`,
                        lineHeight: '1.2'
                      }}
                      className={`text-left pl-4 md:pl-6 font-bold transition-opacity duration-500 ${
                        !isVisible ? 'opacity-0' : isCurrent ? 'opacity-100' : isPast ? 'opacity-25' : 'opacity-40'
                      }`}
                    >
                      {l.en}
                    </div>
                  </div>
                );
              })}
              {bottomSpacerHeight > 0 && (
                <div style={{ height: `${bottomSpacerHeight}px` }} className="w-full shrink-0" aria-hidden="true" />
              )}
            </>
          )}
        </div>
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

function ProjectionView({ songs, playback, onExit, connected }) {
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

  const song = useMemo(() => songs.find((s) => s.id === playback.songId) || null, [songs, playback.songId]);
  const lines = useMemo(() => (song ? sortedLines(song) : []), [song]);
  const isSongCompleted = useSongCompleted(lines, playback);
  const showText = !blackout && playback.status === 'playing' && song;
  const activeLineIdx = useLineIndex(lines, playback, 0);
  const idx = showText ? activeLineIdx : -1;
  const activeLine = idx >= 0 ? lines[idx] : null;
  const line = (activeLine && !activeLine.stageOnly) ? activeLine : null;
  const pulseDuration = song ? 60 / (song.bpm || 60) : 1;
  const containerRef = useRef(null);

  const fontSize = playback.fontSize !== undefined ? playback.fontSize : 64;
  const translationPercent = playback.translationPercent !== undefined ? playback.translationPercent : 60;
  const translationSpacing = playback.translationSpacing !== undefined ? playback.translationSpacing : 24;
  const positionX = playback.positionX !== undefined ? playback.positionX : 50;
  const positionY = playback.positionY !== undefined ? playback.positionY : 50;
  const liveWidthPercent = playback.liveWidthPercent !== undefined ? playback.liveWidthPercent : 100;
  const liveTextAlign = playback.liveTextAlign || 'center';
  const showHeartbeat = playback.showHeartbeat !== undefined ? playback.showHeartbeat : true;

  const alignClass = liveTextAlign === 'left'
    ? 'items-start text-left'
    : liveTextAlign === 'right'
    ? 'items-end text-right'
    : 'items-center text-center';

  const requestFs = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 select-none cursor-none" style={{ background: COLORS.stageBg }}>
      {line && (
        <div
          className={`absolute flex flex-col pointer-events-none ${alignClass}`}
          style={{
            left: `${positionX}%`,
            top: `${positionY}%`,
            transform: 'translate(-50%, -50%)',
            width: `${liveWidthPercent}%`,
            rowGap: `${translationSpacing}px`,
          }}
        >
          <div
            style={{
              color: COLORS.stageText,
              fontFamily: 'Gelasio, Georgia, "Iowan Old Style", ui-serif, serif',
              fontSize: `${fontSize}px`,
              width: '100%',
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
              width: '100%',
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
        className="fixed top-0 right-0 w-24 h-24 bg-transparent border-0 outline-none z-50 focus:opacity-0"
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

function PlayersView({ players = {}, localPlayerId, onSetPlayerRole, onDeletePlayer }) {
  const { colors: COLORS, isDark } = useTheme();
  const playerList = Object.values(players);

  return (
    <div className="min-h-screen pb-10" style={{ background: COLORS.panelBg }}>
      <div className="max-w-[1200px] w-full mx-auto p-4 md:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Player-Verwaltung</h1>
            <p className="text-xs" style={{ color: COLORS.inkDim }}>
              Verbundene Geräte verwalten und Rollen (Projektion / Stageview) zuweisen.
            </p>
          </div>
        </div>

        <div className="rounded-xl p-5 space-y-4 shadow-sm" style={{ background: COLORS.panelBg2 }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: COLORS.line }}>
            <span className="font-semibold text-sm" style={{ color: COLORS.ink }}>
              Verbundene Player ({playerList.length})
            </span>
          </div>

          {playerList.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="text-sm font-medium" style={{ color: COLORS.ink }}>
                Aktuell sind keine Player verbunden.
              </div>
              <div className="text-xs max-w-md mx-auto" style={{ color: COLORS.inkDim }}>
                Öffne auf einem anderen Gerät die URL <code className="font-mono px-1 py-0.5 rounded font-semibold" style={{ background: COLORS.line, color: COLORS.ink }}>/player</code>, um das Gerät automatisch hier registrieren zu lassen.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {playerList.map((p) => {
                const isSelf = p.id === localPlayerId;
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-lg shadow-sm space-y-3 border"
                    style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${p.online ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-zinc-400'}`}
                          title={p.online ? 'Online' : 'Offline'}
                        />
                        <span className="font-mono text-xs font-bold" style={{ color: COLORS.ink }}>
                          {p.id}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            Dieses Gerät
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onDeletePlayer(p.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                        title="Player entfernen"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium" style={{ color: COLORS.inkDim }}>
                        Zugewiesene Rolle:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onSetPlayerRole(p.id, 'live')}
                          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                            p.role === 'live'
                              ? 'bg-amber-500 text-black font-bold shadow-sm'
                              : isDark
                              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                        >
                          Live
                        </button>
                        <button
                          onClick={() => onSetPlayerRole(p.id, 'stage')}
                          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                            p.role === 'stage'
                              ? 'bg-amber-500 text-black font-bold shadow-sm'
                              : isDark
                              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                        >
                          Stage
                        </button>
                        <button
                          onClick={() => onSetPlayerRole(p.id, null)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                            !p.role
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold'
                              : isDark
                              ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          Keine
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopMenuBar({ activeView, onNavigate, onGotoProjection, onGotoStage, playersCount = 0 }) {
  const { colors: COLORS, isDark, toggleTheme } = useTheme();
  const navItems = [
    { id: 'control', label: 'Steuerung', icon: MonitorPlay },
    { id: 'editor', label: 'Song-Editor', icon: Music },
    { id: 'players', label: `Player-Verwaltung${playersCount > 0 ? ` (${playersCount})` : ''}`, icon: Tablet },
    { id: 'options', label: 'Einstellungen', icon: Sliders },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur-md transition-colors" style={{ background: COLORS.panelBg + 'ee', borderColor: COLORS.line }}>
      <div className="max-w-[1200px] mx-auto px-3 sm:px-4 md:px-8 flex items-center justify-between h-14">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto py-1 min-w-0 no-scrollbar">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="font-bold text-sm sm:text-base tracking-tight" style={{ color: COLORS.ink }}>Autolyrics</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded hidden sm:inline" style={{ background: COLORS.panelBg2, color: COLORS.inkDim }}>
              v{versionData.version}
            </span>
          </div>

          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-all ${
                    isActive
                      ? 'shadow-sm font-semibold'
                      : 'hover:opacity-100 opacity-80'
                  }`}
                  style={{
                    background: isActive ? COLORS.amber : 'transparent',
                    color: isActive ? '#241a08' : COLORS.ink,
                  }}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden">
                    {item.id === 'control' ? 'Steuerung' : item.id === 'editor' ? 'Editor' : item.id === 'players' ? `Player${playersCount > 0 ? ` (${playersCount})` : ''}` : 'Optionen'}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Quick actions for Theme Toggle, Live & Stage View */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-lg text-xs font-semibold shadow-sm transition-all hover:opacity-90 border"
            style={{
              background: COLORS.panelBg2,
              borderColor: COLORS.line,
              color: COLORS.ink,
            }}
            title={isDark ? 'Heller Modus aktivieren' : 'Dunkler Modus (Dark Mode) aktivieren'}
            aria-label={isDark ? 'Heller Modus' : 'Dunkler Modus'}
          >
            {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} style={{ color: COLORS.ink }} />}
          </button>
          <button
            onClick={onGotoProjection}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all hover:opacity-90"
            style={{ background: COLORS.ink, color: COLORS.stageText }}
            title="Projektionsansicht (/live) öffnen"
          >
            <Eye size={14} />
            <span className="hidden md:inline">Projektion</span>
          </button>
          <button
            onClick={onGotoStage}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all hover:opacity-90"
            style={{ background: COLORS.ink, color: COLORS.stageText }}
            title="Stageview-Ansicht (/stage) öffnen"
          >
            <Tv size={14} />
            <span className="hidden md:inline">Stageview</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function ControlView({
  songs,
  playback,
  elapsed,
  onLoad,
  onTogglePlay,
  onStop,
  onSeek,
  onNudge,
  onPlayFromLine,
}) {
  const { colors: COLORS, isDark } = useTheme();
  const song = useMemo(() => songs.find((s) => s.id === playback.songId) || null, [songs, playback.songId]);
  const lines = useMemo(() => (song ? sortedLines(song) : []), [song]);
  const idx = song ? currentIndex(lines, elapsed) : -1;
  const duration = getSongDuration(lines);
  const { bar: currentBar, beat: currentBeat } = song
    ? getBarBeat(elapsed, song.bpm, song.timeSigNum)
    : { bar: 1, beat: 1 };

  const handleLineClick = onPlayFromLine || onSeek;
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
                onClick={() => onNudge(-5)}
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
                onClick={() => onNudge(-1)}
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
                onClick={onTogglePlay}
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
                onClick={() => onNudge(1)}
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
                onClick={() => onNudge(5)}
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
                onClick={onStop}
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
                      onLoad(songs[nextIdx]);
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
                    onClick={() => onLoad(s)}
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
                      onClick={() => handleLineClick(l.t)}
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

function ImportExport({ songs, onImport }) {
  const { colors: COLORS, isDark } = useTheme();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('replace');
  const [importFormat, setImportFormat] = useState('json');
  const [songTitle, setSongTitle] = useState('Neuer Song');
  const [bpm, setBpm] = useState(90);

  const exportText = JSON.stringify(songs, null, 2);

  const doCopy = async () => {
    try { await navigator.clipboard.writeText(exportText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };
  const doImport = () => {
    try {
      if (importFormat === 'plaintext') {
        const parsedLines = parsePlaintextSongLines(text);
        if (!parsedLines.length) throw new Error('Keine gültigen Textzeilen gefunden');
        const newSong = {
          id: uid(),
          title: songTitle.trim() || 'Neuer Song',
          bpm: Number(bpm) || 90,
          timeSigNum: 4,
          timingMode: 'bar_beat',
          lines: parsedLines,
        };
        onImport(mode === 'replace' ? [newSong] : [...songs, newSong]);
        setText('');
        return;
      }

      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('erwartet ein Array von Songs');
      const withIds = parsed.map((s) => ({ ...s, id: s.id || uid(), lines: (s.lines || []).map((l) => ({ ...l, id: l.id || uid() })) }));
      onImport(mode === 'replace' ? withIds : [...songs, ...withIds]);
      setText('');
    } catch (e) { alert('Import-Fehler: ' + e.message); }
  };
  const onFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3 pt-4 mt-4 border-t" style={{ borderColor: COLORS.line }}>
      <div className="text-xs uppercase tracking-wide font-bold" style={{ color: COLORS.inkDim }}>Import / Export</div>
      <button onClick={doCopy} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line, color: COLORS.ink }}>
        {copied ? <Check size={12} /> : <Copy size={12} />} Alle Songs als JSON kopieren
      </button>

      <div className="flex gap-2 border-b pb-2 text-xs" style={{ borderColor: COLORS.line }}>
        <button
          onClick={() => setImportFormat('json')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            importFormat === 'json'
              ? 'bg-amber-500 text-black font-bold'
              : isDark
              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-700'
          }`}
        >
          JSON Import
        </button>
        <button
          onClick={() => setImportFormat('plaintext')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            importFormat === 'plaintext'
              ? 'bg-amber-500 text-black font-bold'
              : isDark
              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-700'
          }`}
        >
          Klartext Import (.txt)
        </button>
      </div>

      {importFormat === 'plaintext' && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <input
            type="text"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            placeholder="Songtitel"
            className="px-2 py-1.5 rounded-lg border"
            style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
          />
          <div className="flex items-center gap-1">
            <span style={{ color: COLORS.inkDim }}>BPM:</span>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className="w-20 px-2 py-1.5 rounded-lg border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
          </div>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={importFormat === 'plaintext' ? "Klartext hier einfügen...\nJede Zeile entspricht einem Takt.\n*Zeile für Nur-Stageview\n[Solo] Zeile mit Kommentar" : "JSON hier einfügen zum Importieren…"}
        rows={5}
        className="w-full text-xs rounded-lg p-2 font-mono border"
        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <input type="file" accept={importFormat === 'plaintext' ? ".txt,text/plain" : "application/json"} onChange={onFile} className="text-xs" style={{ color: COLORS.inkDim }} />
        <label className="text-xs flex items-center gap-1" style={{ color: COLORS.inkDim }}><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Ersetzen</label>
        <label className="text-xs flex items-center gap-1" style={{ color: COLORS.inkDim }}><input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Hinzufügen</label>
        <button onClick={doImport} disabled={!text.trim()} className="text-xs px-3 py-1.5 rounded-full disabled:opacity-40" style={{ background: COLORS.amber, color: '#241a08' }}>Importieren</button>
      </div>
    </div>
  );
}

function SongEditor({ song, onChange, onDelete, playback, sendPlayback }) {
  const { colors: COLORS, isDark } = useTheme();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [waveformPlayback, setWaveformPlayback] = useState({ isPlaying: false, currentTime: 0, activeIdx: -1, activeLineId: null });
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

function EditorView({ songs, onChangeSongs, playback, sendPlayback }) {
  const { colors: COLORS, isDark } = useTheme();
  const [selectedId, setSelectedId] = useState(songs[0] ? songs[0].id : null);
  const selected = songs.find((s) => s.id === selectedId) || null;

  const addSong = () => {
    const s = { id: uid(), title: 'Neuer Song', bpm: 90, timingMode: 'bar_beat', lines: [] };
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
      <div className="max-w-[1200px] w-full mx-auto p-4 md:px-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Songs verwalten</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-64 shrink-0 space-y-2">
            <div className="space-y-2 max-h-48 md:max-h-none overflow-y-auto pr-1">
            {songs.map((s, index) => (
              <div
                key={s.id}
                className="flex items-center gap-1 w-full rounded-lg pr-1 border"
                style={{
                  background: s.id === selectedId ? COLORS.amber : COLORS.panelBg2,
                  borderColor: s.id === selectedId ? 'transparent' : COLORS.line,
                }}
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
            </div>
            <button onClick={addSong} className="w-full text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1" style={{ background: COLORS.ink, color: COLORS.stageText }}><Plus size={14} /> Neuer Song</button>
          </div>
          <div className="flex-1 min-w-0">
            {selected ? (
              <SongEditor
                song={selected}
                onChange={updateSong}
                onDelete={() => deleteSong(selected.id)}
                playback={playback}
                sendPlayback={sendPlayback}
              />
            ) : (
              <div className="text-sm" style={{ color: COLORS.inkDim }}>Song auswählen oder neu erstellen.</div>
            )}
            <ImportExport songs={songs} onImport={onChangeSongs} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('autolyrics_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (e) {}
    return 'light';
  });

  const isDark = theme === 'dark';
  const colors = THEME_PALETTES[theme] || THEME_PALETTES.light;
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('autolyrics_theme', theme);
    } catch (e) {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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

  const loadSong = (song) => sendPlayback({ ...playback, songId: song.id, status: 'stopped', anchorEpoch: Date.now(), anchorElapsed: 0 });
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
  const playFromLine = (sec) => {
    sendPlayback({
      ...playback,
      status: 'playing',
      anchorElapsed: Math.max(0, sec),
      anchorEpoch: Date.now(),
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme, colors }}>
      <ConnectionBadge connected={connected} />
      <style>{`
        .choir-beat-dot { animation-name: choirBeatPulse; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes choirBeatPulse { 0% { transform: scale(1); opacity: .15; } 15% { transform: scale(1.8); opacity: .55; } 100% { transform: scale(1); opacity: .15; } }
        @media (prefers-reduced-motion: reduce) { .choir-beat-dot { animation: none; opacity: .3; } }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${colors.amber}; outline-offset: 2px; }
      `}</style>
      {view === 'player' ? (
        localPlayer && localPlayer.role === 'live' ? (
          <ProjectionView songs={songs} playback={playback} onExit={() => changeView('control')} connected={connected} />
        ) : localPlayer && localPlayer.role === 'stage' ? (
          <StageView songs={songs} playback={playback} onExit={() => changeView('control')} />
        ) : (
          <UnassignedPlayerView playerId={playerId} />
        )
      ) : view === 'projection' ? (
        <ProjectionView songs={songs} playback={playback} onExit={() => changeView('control')} connected={connected} />
      ) : view === 'stage' ? (
        <StageView songs={songs} playback={playback} onExit={() => changeView('control')} />
      ) : (
        <div className="min-h-screen" style={{ background: colors.panelBg }}>
          <TopMenuBar
            activeView={view}
            onNavigate={(next) => setView(next)}
            onGotoProjection={() => changeView('projection')}
            onGotoStage={() => changeView('stage')}
            playersCount={Object.keys(players).length}
          />
          {view === 'editor' ? (
            <EditorView
              songs={songs}
              onChangeSongs={sendSongs}
              playback={playback}
              sendPlayback={sendPlayback}
            />
          ) : view === 'options' ? (
            <OptionsView playback={playback} onChangePlayback={(patch) => sendPlayback({ ...playback, ...patch })} />
          ) : view === 'players' ? (
            <PlayersView
              players={players}
              localPlayerId={playerId}
              onSetPlayerRole={sendPlayerRole}
              onDeletePlayer={sendDeletePlayer}
            />
          ) : (
            <ControlView
              songs={songs}
              playback={playback}
              elapsed={elapsed}
              onLoad={loadSong}
              onTogglePlay={togglePlay}
              onStop={stopSong}
              onSeek={playFromLine}
              onPlayFromLine={playFromLine}
              onNudge={nudge}
            />
          )}
        </div>
      )}
    </ThemeContext.Provider>
  );
}
