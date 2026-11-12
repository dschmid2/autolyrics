import { uid } from './ids';
import { computeLinesWithTimes, updateLineTimestamp } from './timing';

// Pure song editing operations. Each returns the new `lines` array (or a song
// patch) and never mutates its input.

export function updateLineIn(song, id, patch) {
  return song.lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
}

// Sets the bar of one line; with a valid number, all following lines in
// bar/beat mode are shifted by the same number of bars
export function changeLineBar(song, lineId, newBarVal) {
  const lineIndex = song.lines.findIndex((l) => l.id === lineId);
  if (lineIndex === -1) return song.lines;
  const currentLine = song.lines[lineIndex];

  if (newBarVal === '' || newBarVal === null || newBarVal === undefined) {
    return updateLineIn(song, lineId, { bar: '' });
  }

  const parsedNewBar = parseInt(newBarVal, 10);
  if (isNaN(parsedNewBar)) {
    return updateLineIn(song, lineId, { bar: newBarVal });
  }

  const oldBar = currentLine.bar !== undefined && currentLine.bar !== null && currentLine.bar !== ''
    ? Number(currentLine.bar)
    : 1;

  const deltaBar = parsedNewBar - oldBar;
  if (deltaBar === 0) {
    return updateLineIn(song, lineId, { bar: parsedNewBar });
  }

  const defaultMode = song.timingMode || 'bar_beat';
  return song.lines.map((l, idx) => {
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
