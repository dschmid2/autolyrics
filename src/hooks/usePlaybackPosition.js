import { useState, useEffect, useRef } from 'react';
import { computeElapsed } from '../lib/playback';
import { getSongDuration, currentIndex, startedIndex } from '../lib/timing';

export function useElapsed(playback) {
  const [elapsed, setElapsed] = useState(() => computeElapsed(playback));
  useEffect(() => {
    setElapsed(computeElapsed(playback));
    if (playback.status !== 'playing') return;
    const iv = setInterval(() => setElapsed(computeElapsed(playback)), 100);
    return () => clearInterval(iv);
  }, [playback]);
  return elapsed;
}

// Value of `compute()` for the current render, plus a 100 ms ticker (only while
// playing) that re-renders when the value changes. The value is computed during
// render, never taken from state: a stale value from the previous song could
// point to a line that the new song does not have.
function useTickedValue(compute, playback, lines, intervalMs = 100) {
  const value = compute();
  const [, forceRender] = useState(0);
  const latest = useRef({ compute, value });
  latest.current = { compute, value };

  useEffect(() => {
    if (playback.status !== 'playing' || !lines || !lines.length) return;
    const iv = setInterval(() => {
      if (latest.current.compute() !== latest.current.value) forceRender((n) => n + 1);
    }, intervalMs);
    return () => clearInterval(iv);
  }, [playback, lines, intervalMs]);

  return value;
}

// Index of the line that is live right now (-1 = none)
export function useLineIndex(lines, playback, leadSeconds = 0) {
  return useTickedValue(() => {
    if (!lines || !lines.length) return -1;
    return currentIndex(lines, computeElapsed(playback) + leadSeconds);
  }, playback, lines);
}

// Stage view line state:
//  activeIdx   -> line that is currently sung (white), -1 if none
//  positionIdx -> line the view is centered on. Before the first line this is
//                 line 0 (shown grey until its time); after a line's duration
//                 or the song end the view stays on the last started line.
export function useStageLineState(lines, playback, leadSeconds = 0) {
  const key = useTickedValue(() => {
    if (!lines || !lines.length) return '-1:0';
    const el = computeElapsed(playback) + leadSeconds;
    const active = currentIndex(lines, el);
    const position = active >= 0 ? active : Math.max(0, startedIndex(lines, el));
    return `${active}:${position}`;
  }, playback, lines);
  const [activeIdx, positionIdx] = key.split(':').map(Number);
  return { activeIdx, positionIdx };
}

export function useSongCompleted(lines, playback) {
  return useTickedValue(() => {
    if (!lines || !lines.length) return false;
    return computeElapsed(playback) >= getSongDuration(lines);
  }, playback, lines, 200);
}
