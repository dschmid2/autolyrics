import { uid } from './ids';
import { updateLineTimestamp } from './timing';

// Lines after dragging the marker of line `lineIdx` (index in the computed,
// time-sorted lines captured when the drag started) to `newTime`.
// mode 'single': only this marker moves; 'following': this and all later
// markers move by the same delta.
export function moveMarker(song, initialComputedLines, lineIdx, line, newTime, mode) {
  const origTime = initialComputedLines[lineIdx] ? initialComputedLines[lineIdx].t : 0;
  const deltaT = newTime - origTime;

  if (mode === 'single') {
    let prevTime = 0;
    if (lineIdx > 0 && initialComputedLines[lineIdx - 1]) {
      prevTime = initialComputedLines[lineIdx - 1].t;
    }
    const patch = updateLineTimestamp(line, newTime, song, prevTime);
    return song.lines.map((l) => (l.id === line.id ? { ...l, ...patch } : l));
  }

  const mapUpdated = new Map();
  let currentPrevTime = lineIdx > 0 && initialComputedLines[lineIdx - 1] ? initialComputedLines[lineIdx - 1].t : 0;

  for (let j = lineIdx; j < initialComputedLines.length; j++) {
    const item = initialComputedLines[j];
    const targetTime = j === lineIdx ? newTime : Math.max(0, item.t + deltaT);
    const patch = updateLineTimestamp(item, targetTime, song, currentPrevTime);
    mapUpdated.set(item.id, patch);
    currentPrevTime = targetTime;
  }

  return song.lines.map((l) => {
    if (mapUpdated.has(l.id)) {
      return { ...l, ...mapUpdated.get(l.id) };
    }
    return l;
  });
}

// New empty line with its marker at `time` (bar/beat or seconds, depending on
// the song's timing mode)
export function createLineAt(song, time) {
  const t = Math.round(time * 100) / 100;
  const bpm = Number(song.bpm) || 90;
  const timeSigNum = Number(song.timeSigNum) || 4;
  const defaultMode = song.timingMode || 'bar_beat';
  let timingPatch = { mode: defaultMode };

  if (defaultMode === 'bar_beat') {
    const totalBeats = Math.max(0, t * (bpm / 60));
    const bar = Math.floor(totalBeats / timeSigNum) + 1;
    const beat = Math.floor(totalBeats % timeSigNum) + 1;
    timingPatch = { mode: 'bar_beat', bar, beat };
  } else {
    timingPatch = { mode: 'sec', timeSec: t };
  }

  return {
    id: uid(),
    en: '',
    de: '',
    duration: '',
    ...timingPatch
  };
}
