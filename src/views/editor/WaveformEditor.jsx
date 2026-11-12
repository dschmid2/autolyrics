import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Plus, ZoomIn, ZoomOut, Clock, Tv } from 'lucide-react';
import { COLORS } from '../../theme';
import { useAudioBuffer } from '../../hooks/useAudioBuffer';
import { uid } from '../../lib/ids';
import { getSongDuration, currentIndex, fmtTimeWithTenths, updateLineTimestamp } from '../../lib/timing';
import { WaveformCanvas } from './WaveformCanvas';
import { withAnchor } from '../../lib/playback';

export function WaveformEditor({ song, computedLines, onUpdateSong, onPlaybackStateChange, seekRef, playback, sendPlayback }) {
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
    sendPlayback(withAnchor(playbackRef.current || {}, {
      songId: songRef.current.id,
      status,
      anchorElapsed: Math.max(0, elapsed),
    }));
  }, [sendPlayback]);

  useEffect(() => {
    return () => {
      // If sendToScreens was active when component unmounts, stop screens
      if (sendToScreensRef.current && sendPlayback && playbackRef.current) {
        sendPlayback(withAnchor(playbackRef.current, {
          songId: songRef.current.id,
          status: 'stopped',
          anchorElapsed: 0,
        }));
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
        sendPlayback(withAnchor(playbackRef.current || {}, {
          songId: songRef.current.id,
          status: 'stopped',
          anchorElapsed: 0,
        }));
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
