// Line times of a song. Shared between the server (auto-advance to the next
// song) and the React client (src/lib/timing.js re-exports these).
// public/legacy.js keeps its own ES5 copy.

function getBarBeat(time, bpm = 90, timeSigNum = 4) {
  const safeBpm = Number(bpm) || 90;
  const safeTimeSig = Number(timeSigNum) || 4;
  const beats = Math.max(0, time * (safeBpm / 60));
  const bar = Math.floor(beats / safeTimeSig + 1e-4) + 1;
  const beat = Math.floor((beats + 1e-4) % safeTimeSig) + 1;
  return { bar, beat };
}

function computeLinesWithTimes(song) {
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

function getSongDuration(lines) {
  if (!lines || !lines.length) return 0;
  const lastLine = lines[lines.length - 1];
  const dur = lastLine.duration !== null && lastLine.duration !== undefined && lastLine.duration !== '' ? Number(lastLine.duration) : 4;
  return lastLine.t + dur;
}

module.exports = { getBarBeat, computeLinesWithTimes, getSongDuration };
