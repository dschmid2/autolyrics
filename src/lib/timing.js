export function getBarBeat(time, bpm = 90, timeSigNum = 4) {
  const safeBpm = Number(bpm) || 90;
  const safeTimeSig = Number(timeSigNum) || 4;
  const beats = Math.max(0, time * (safeBpm / 60));
  const bar = Math.floor(beats / safeTimeSig + 1e-4) + 1;
  const beat = Math.floor((beats + 1e-4) % safeTimeSig) + 1;
  return { bar, beat };
}

export function computeLinesWithTimes(song) {
  if (!song || !Array.isArray(song.lines)) return [];
  const bpm = Number(song.bpm) || 90;
  const timeSigNum = Number(song.timeSigNum) || 4;
  const lines = [];
  let prevTime = 0;
  const defaultMode = song?.timingMode || 'bar_beat';

  for (let i = 0; i < song.lines.length; i++) {
    const l = song.lines[i];
    const mode = l.mode || defaultMode;
    let t = 0;
    let bar = l.bar !== undefined && l.bar !== null ? Number(l.bar) : undefined;
    let beat = l.beat !== undefined && l.beat !== null ? Number(l.beat) : undefined;

    if (mode === 'sec') {
      t = Number(l.timeSec) || 0;
    } else if (mode === 'relative') {
      const rel = Number(l.relativeSec) || 0;
      t = prevTime + rel;
    } else if (mode === 'relative_bar_beat') {
      const relBar = Number(l.relativeBar) || 0;
      const relBeat = Number(l.relativeBeat) || 0;
      const totalBeats = relBar * timeSigNum + relBeat;
      t = prevTime + totalBeats * (60 / bpm);
    } else if (mode === 'bar_beat') {
      bar = Number(l.bar) || 1;
      beat = Number(l.beat) || 1;
      const totalBeats = (bar - 1) * timeSigNum + (beat - 1);
      t = Math.max(0, totalBeats * (60 / bpm));
    } else if (mode === 'beat') {
      beat = Number(l.beat) || 1;
      t = Math.max(0, (beat - 1) * 60 / bpm);
    } else {
      t = Number(l.timeSec) || 0;
    }

    if (bar === undefined || beat === undefined || mode !== 'bar_beat') {
      const bb = getBarBeat(t, bpm, timeSigNum);
      bar = bb.bar;
      beat = bb.beat;
    }

    const duration = l.duration !== undefined && l.duration !== null && l.duration !== '' ? Number(l.duration) : null;
    lines.push({ ...l, mode, t, duration, bar, beat });
    prevTime = t;
  }

  return lines.sort((a, b) => a.t - b.t);
}

export function sortedLines(song) {
  return computeLinesWithTimes(song);
}

export function getSongDuration(lines) {
  if (!lines || !lines.length) return 0;
  const lastLine = lines[lines.length - 1];
  const dur = lastLine.duration !== null && lastLine.duration !== undefined && lastLine.duration !== '' ? Number(lastLine.duration) : 4;
  return lastLine.t + dur;
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
