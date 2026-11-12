import { useState, useEffect, useRef } from 'react';
import { Maximize2, X } from 'lucide-react';
import { COLORS } from '../theme';
import { useStageLineState } from '../hooks/usePlaybackPosition';
import { getSetting } from '../lib/playback';
import { BeatDot } from '../components/display/BeatDot';
import { useCurrentSong } from '../hooks/useCurrentSong';
import { useFullscreen } from '../hooks/useFullscreen';

export function StageView({ songs, playback, onExit }) {
  const { song, lines } = useCurrentSong(songs, playback);
  const stageLeadSeconds = getSetting(playback, 'stageLeadSeconds');
  const stagePastLines = getSetting(playback, 'stagePastLines');
  const stageFutureLines = getSetting(playback, 'stageFutureLines');
  const stageLineSpacing = getSetting(playback, 'stageLineSpacing');
  const stagePositionY = getSetting(playback, 'stagePositionY');
  const { activeIdx, positionIdx: currentIdx } = useStageLineState(lines, playback, stageLeadSeconds);

  const stageFontSize = getSetting(playback, 'stageFontSize');
  const stageShowTitle = !!playback.stageShowTitle;
  const showHeartbeat = getSetting(playback, 'showHeartbeat');
  const commentPercent = getSetting(playback, 'stageCommentWidthPercent');

  const [containerRef, requestFs] = useFullscreen();
  const lineRefs = useRef([]);
  const [activeCenterOffset, setActiveCenterOffset] = useState(0);


  const measuredHeightsRef = useRef({});
  const prevSongIdRef = useRef(song?.id);
  const prevFontSizeRef = useRef(stageFontSize);
  const prevSpacingRef = useRef(stageLineSpacing);

  if (
    prevSongIdRef.current !== song?.id ||
    prevFontSizeRef.current !== stageFontSize ||
    prevSpacingRef.current !== stageLineSpacing
  ) {
    prevSongIdRef.current = song?.id;
    prevFontSizeRef.current = stageFontSize;
    prevSpacingRef.current = stageLineSpacing;
    measuredHeightsRef.current = {};
    lineRefs.current = [];
  }

  const lineRowHeight = Math.max(20, Math.round(stageFontSize * 1.2 + stageLineSpacing));

  const startIndex = Math.max(0, currentIdx - stagePastLines - 1);
  const endIndex = Math.min(lines.length - 1, currentIdx + stageFutureLines + 1);

  // Compute top spacer height from the sum of measured heights of previous lines (or lineRowHeight fallback)
  let topSpacerHeight = 0;
  for (let i = 0; i < startIndex; i++) {
    topSpacerHeight += (measuredHeightsRef.current[i] || lineRowHeight);
  }

  // Compute bottom spacer height from the sum of measured heights of subsequent lines (or lineRowHeight fallback)
  let bottomSpacerHeight = 0;
  for (let i = endIndex + 1; i < lines.length; i++) {
    bottomSpacerHeight += (measuredHeightsRef.current[i] || lineRowHeight);
  }

  // Dynamically compute the vertical center of the active line row so wrapped lines push subsequent lines down
  useEffect(() => {
    // Record heights of all currently rendered line elements
    for (let i = startIndex; i <= endIndex; i++) {
      const el = lineRefs.current[i];
      if (el && el.offsetHeight > 0) {
        measuredHeightsRef.current[i] = el.offsetHeight;
      }
    }

    const updateOffset = () => {
      const activeEl = lineRefs.current[currentIdx];
      if (activeEl) {
        const lineTop = activeEl.offsetTop;
        const lineHeight = activeEl.offsetHeight;
        setActiveCenterOffset(lineTop + lineHeight / 2);
      } else {
        let offset = 0;
        for (let i = 0; i < currentIdx; i++) {
          offset += (measuredHeightsRef.current[i] || lineRowHeight);
        }
        offset += (measuredHeightsRef.current[currentIdx] || lineRowHeight) / 2;
        setActiveCenterOffset(offset);
      }
    };

    updateOffset();
    const handleResize = () => {
      measuredHeightsRef.current = {};
      updateOffset();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentIdx, lines, stageFontSize, stageLineSpacing, commentPercent, lineRowHeight, startIndex, endIndex]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 select-none cursor-none flex flex-col justify-center items-center px-6 overflow-hidden"
      style={{ background: COLORS.stageBg }}
    >
      {stageShowTitle && (
        <div
          className="w-full shrink-0 border-b border-zinc-800 py-3 truncate"
          style={{
            color: COLORS.stageTextDim,
            fontFamily: 'Gelasio, Georgia, "Iowan Old Style", ui-serif, serif',
            fontSize: `${stageFontSize * 0.5}px`,
            lineHeight: '1.2',
            paddingLeft: commentPercent > 0 && commentPercent < 100 ? `calc(${commentPercent}% + 1.5rem)` : 0,
          }}
        >
          {song ? song.title : ''}
        </div>
      )}
      <div className="relative w-full flex-1 min-h-0 overflow-hidden">
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
                // The centered line is only highlighted once its time has come
                const isCurrent = i === currentIdx && activeIdx >= 0;
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
        <BeatDot bpm={song.bpm} />
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
