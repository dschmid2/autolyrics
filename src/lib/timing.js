import { computeLinesWithTimes, getSongDuration } from '../../shared/songTiming';

export { getBarBeat, computeLinesWithTimes, getSongDuration } from '../../shared/songTiming';

export function sortedLines(song) {
  return computeLinesWithTimes(song);
}

// A line counts as started slightly before its exact timestamp, so a jump to a
// line is never shown as the previous line because of a few ms of clock error.
export const LINE_START_TOLERANCE = 0.05;

export function currentIndex(lines, elapsed) {
  if (!lines || !lines.length) return -1;
  const duration = getSongDuration(lines);
  if (elapsed >= duration) return -1;

  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= elapsed + LINE_START_TOLERANCE) {
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

// Index of the last line whose start time has been reached (ignores line
// durations and the song end), or -1 before the first line.
export function startedIndex(lines, elapsed) {
  if (!lines || !lines.length) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= elapsed + LINE_START_TOLERANCE) idx = i;
    else break;
  }
  return idx;
}

export function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function fmtTimeWithTenths(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const tenths = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, '0')}.${tenths}`;
}

export function updateLineTimestamp(line, newTime, song, prevLineTime) {
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
