import { uid } from './ids';
import { computeLinesWithTimes, updateLineTimestamp } from './timing';

// Pure song editing operations. Each returns the new `lines` array (or a song
// patch) and never mutates its input.

export function updateLineIn(song, id, patch) {
  return song.lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
}

// Timing mode of a line (falls back to the song's mode)
function modeOf(song, line) {
  return line.mode || song.timingMode || 'bar_beat';
}

const num = (value, fallback) => {
  const n = Number(value);
  return value === '' || value === null || value === undefined || !Number.isFinite(n) ? fallback : n;
};

// How far an edit moved a line: { beats, seconds }, or null if it did not move
// (or for relative modes, where following lines move along anyway)
function timingDelta(song, before, after) {
  const bpm = Number(song.bpm) || 90;
  const sig = Number(song.timeSigNum) || 4;
  const mode = modeOf(song, after);
  let beats = null;
  let seconds = null;
  if (mode === 'bar_beat') {
    const total = (l) => (num(l.bar, 1) - 1) * sig + (num(l.beat, 1) - 1);
    beats = total(after) - total(before);
  } else if (mode === 'beat') {
    beats = num(after.beat, 1) - num(before.beat, 1);
  } else if (mode === 'sec') {
    seconds = num(after.timeSec, 0) - num(before.timeSec, 0);
  } else {
    return null;
  }
  if (beats === null) beats = seconds * (bpm / 60);
  if (seconds === null) seconds = beats * (60 / bpm);
  return beats === 0 && seconds === 0 ? null : { beats, seconds };
}

// A line moved by `delta`, in its own timing mode (never before the song start)
function shiftLine(song, line, delta) {
  const sig = Number(song.timeSigNum) || 4;
  const mode = modeOf(song, line);
  if (mode === 'bar_beat') {
    const total = Math.max(0, (num(line.bar, 1) - 1) * sig + (num(line.beat, 1) - 1) + Math.round(delta.beats));
    return { ...line, bar: Math.floor(total / sig) + 1, beat: (total % sig) + 1 };
  }
  if (mode === 'beat') {
    return { ...line, beat: Math.max(1, num(line.beat, 1) + Math.round(delta.beats)) };
  }
  if (mode === 'sec') {
    return { ...line, timeSec: Math.max(0, Math.round((num(line.timeSec, 0) + delta.seconds) * 100) / 100) };
  }
  return line;
}

// Applies a change of a line's time fields (bar, beat, timeSec).
// shiftMode 'single': only this line. 'following': all lines that come after
// it in time move by the same amount (same rule as dragging a marker).
export function changeLineTiming(song, lineId, patch, shiftMode) {
  const before = song.lines.find((l) => l.id === lineId);
  if (!before) return song.lines;
  const after = { ...before, ...patch };
  const lines = song.lines.map((l) => (l.id === lineId ? after : l));
  if (shiftMode !== 'following') return lines;

  const delta = timingDelta(song, before, after);
  if (!delta) return lines;
  const ordered = computeLinesWithTimes(song);
  const position = ordered.findIndex((l) => l.id === lineId);
  const followingIds = new Set(ordered.slice(position + 1).map((l) => l.id));
  return lines.map((l) => (followingIds.has(l.id) ? shiftLine(song, l, delta) : l));
}

// Song patch switching all lines to another timing mode, keeping their times
export function changeTimingMode(song, newMode) {
  const computed = computeLinesWithTimes(song);
  const updatedLines = song.lines.map((l) => {
    const comp = computed.find((c) => c.id === l.id);
    const t = comp ? comp.t : 0;
    const patch = updateLineTimestamp({ ...l, mode: newMode }, t, song, 0);
    return { ...l, mode: newMode, ...patch };
  });
  return { timingMode: newMode, lines: updatedLines };
}

// Inserts an empty line after `index` (-1 = at the beginning) with a sensible
// time derived from its neighbour
export function insertLineAfter(song, index) {
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
  lines.splice(index + 1, 0, newLine);
  return lines;
}

// Swaps a line with its neighbour (dir -1 = up, 1 = down); null if not possible
export function moveLineBy(song, id, dir) {
  const idx = song.lines.findIndex((l) => l.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= song.lines.length) return null;
  const next = [...song.lines];
  [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
  return next;
}
