import { useState, useEffect } from 'react';
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

export function useLineIndex(lines, playback, leadSeconds = 0) {
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

// Stage view line state:
//  activeIdx   -> line that is currently sung (white), -1 if none
//  positionIdx -> line the view is centered on. Before the first line this is
//                 line 0 (shown grey until its time); after a line's duration
//                 or the song end the view stays on the last started line.
export function useStageLineState(lines, playback, leadSeconds = 0) {
  const compute = () => {
    if (!lines || !lines.length) return '-1:0';
    const el = computeElapsed(playback) + leadSeconds;
    const active = currentIndex(lines, el);
    const position = active >= 0 ? active : Math.max(0, startedIndex(lines, el));
    return `${active}:${position}`;
  };

  const [key, setKey] = useState(compute);

  useEffect(() => {
    setKey(compute());
    if (playback.status !== 'playing' || !lines || !lines.length) return;
    const iv = setInterval(() => {
      const next = compute();
      setKey((prev) => (prev !== next ? next : prev));
    }, 100);
    return () => clearInterval(iv);
  }, [playback, lines, leadSeconds]);

  const [activeIdx, positionIdx] = key.split(':').map(Number);
  return { activeIdx, positionIdx };
}

export function useSongCompleted(lines, playback) {
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
