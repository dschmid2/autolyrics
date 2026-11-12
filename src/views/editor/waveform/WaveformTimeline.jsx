import { fmtTimeWithTenths } from '../../../lib/timing';
import { moveMarker } from '../../../lib/markerEdits';
import { WaveformCanvas } from './WaveformCanvas';

// Scrollable waveform with playhead, draggable audio-start handle and
// draggable line markers. Clicking the empty area seeks.
export function WaveformTimeline({
  containerRef, loading, error, audioBuffer, song, computedLines, activeIdx,
  currentTime, pxPerSec, bpm, timeSigNum, audioOffset, totalDuration, canvasWidth,
  isDragging, setIsDragging, markerDragMode, onSeek, onUpdateSong,
}) {
  const handleContainerClick = (e) => {
    if (isDragging) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const seekTime = Math.max(0, Math.min(totalDuration, x / pxPerSec));
    onSeek(seekTime);
  };

  // Calls onMove(time under the pointer) until the pointer is released
  const startDrag = (e, onMove) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    const container = containerRef.current;
    if (!container) return;

    const onPointerMove = (moveEv) => {
      const rect = container.getBoundingClientRect();
      const x = moveEv.clientX - rect.left + container.scrollLeft;
      onMove(x / pxPerSec);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handleAudioOffsetPointerDown = (e) => {
    startDrag(e, (time) => onUpdateSong({ audioOffset: Math.round(time * 10) / 10 }));
  };

  const handleMarkerPointerDown = (e, line, lineIdx) => {
    const initialComputedLines = [...computedLines];
    startDrag(e, (time) => {
      const newTime = Math.max(0, Math.min(totalDuration, time));
      onUpdateSong({ lines: moveMarker(song, initialComputedLines, lineIdx, line, newTime, markerDragMode) });
    });
  };

  return loading ? (
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
  );
}
