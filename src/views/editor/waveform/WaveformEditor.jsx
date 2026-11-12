import { useState, useEffect, useRef } from 'react';
import { useAudioBuffer } from '../../../hooks/useAudioBuffer';
import { useWaveformTransport } from '../../../hooks/useWaveformTransport';
import { getSongDuration, currentIndex } from '../../../lib/timing';
import { createLineAt } from '../../../lib/markerEdits';
import { WaveformPreview } from './WaveformPreview';
import { WaveformToolbar } from './WaveformToolbar';
import { WaveformTimeline } from './WaveformTimeline';

// Audio player + waveform with draggable line markers for one song
export function WaveformEditor({ song, computedLines, onUpdateSong, onPlaybackStateChange, seekRef, playback, sendPlayback }) {
  const { audioBuffer, loading, error } = useAudioBuffer(song.audioUrl);
  const audioRef = useRef(null);
  const containerRef = useRef(null);
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

  const transport = useWaveformTransport({
    song, audioRef, containerRef, audioBuffer, audioDuration, audioOffset,
    totalDuration, pxPerSec, isDragging, playback, sendPlayback, seekRef,
  });
  const { isPlaying, currentTime } = transport;

  const activeIdx = currentIndex(computedLines, currentTime);
  const activeLine = activeIdx >= 0 ? computedLines[activeIdx] : null;

  // Report only play state and the active line (by id) to the parent, so the
  // parent re-renders on changes and not on every animation frame
  const activeLineId = activeLine ? activeLine.id : null;
  useEffect(() => {
    if (onPlaybackStateChange) {
      onPlaybackStateChange({ isPlaying, activeLineId });
    }
  }, [onPlaybackStateChange, isPlaying, activeLineId]);

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ background: '#0F0F12', color: '#F4EFE4' }}>
      <audio ref={audioRef} src={song.audioUrl} onEnded={transport.handleAudioEnded} />

      <WaveformPreview activeLine={activeLine} currentTime={currentTime} bpm={bpm} timeSigNum={timeSigNum} />

      <WaveformToolbar
        isPlaying={isPlaying}
        currentTime={currentTime}
        onTogglePlay={transport.togglePlay}
        onStop={transport.stop}
        onNudge={transport.nudge}
        onAddMarker={() => onUpdateSong({ lines: [...song.lines, createLineAt(song, currentTime)] })}
        song={song}
        onUpdateSong={onUpdateSong}
        markerDragMode={markerDragMode}
        onMarkerDragModeChange={setMarkerDragMode}
        sendToScreens={transport.sendToScreens}
        onToggleSendToScreens={transport.toggleSendToScreens}
        pxPerSec={pxPerSec}
        onZoomChange={setPxPerSec}
      />

      <WaveformTimeline
        containerRef={containerRef}
        loading={loading}
        error={error}
        audioBuffer={audioBuffer}
        song={song}
        computedLines={computedLines}
        activeIdx={activeIdx}
        currentTime={currentTime}
        pxPerSec={pxPerSec}
        bpm={bpm}
        timeSigNum={timeSigNum}
        audioOffset={audioOffset}
        totalDuration={totalDuration}
        canvasWidth={canvasWidth}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        markerDragMode={markerDragMode}
        onSeek={transport.seekToTime}
        onUpdateSong={onUpdateSong}
      />
    </div>
  );
}
