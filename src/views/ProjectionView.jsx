import { useState, useEffect } from 'react';
import { Maximize2, X } from 'lucide-react';
import { COLORS } from '../theme';
import { useLineIndex, useSongCompleted } from '../hooks/usePlaybackPosition';
import { getSetting } from '../lib/playback';
import { BeatDot } from '../components/display/BeatDot';
import { useCurrentSong } from '../hooks/useCurrentSong';
import { useFullscreen } from '../hooks/useFullscreen';

export function ProjectionView({ songs, playback, onExit, connected }) {
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

  const { song, lines } = useCurrentSong(songs, playback);
  const isSongCompleted = useSongCompleted(lines, playback);
  const showText = !blackout && playback.status === 'playing' && song;
  const activeLineIdx = useLineIndex(lines, playback, 0);
  const idx = showText ? activeLineIdx : -1;
  const activeLine = idx >= 0 ? lines[idx] : null;
  const line = (activeLine && !activeLine.stageOnly) ? activeLine : null;
  const [containerRef, requestFs] = useFullscreen();

  const fontSize = getSetting(playback, 'fontSize');
  const translationPercent = getSetting(playback, 'translationPercent');
  const translationSpacing = getSetting(playback, 'translationSpacing');
  const positionX = getSetting(playback, 'positionX');
  const positionY = getSetting(playback, 'positionY');
  const liveWidthPercent = getSetting(playback, 'liveWidthPercent');
  const liveTextAlign = playback.liveTextAlign || 'center';
  const showHeartbeat = getSetting(playback, 'showHeartbeat');

  const alignClass = liveTextAlign === 'left'
    ? 'items-start text-left'
    : liveTextAlign === 'right'
    ? 'items-end text-right'
    : 'items-center text-center';

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
        <BeatDot bpm={song.bpm} />
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
