// Loads the next song automatically once the current one has finished, so the
// stage display already shows it. The server owns this timer (not a browser):
// it also works with no operator screen open and can never fire twice.
const { computeLinesWithTimes, getSongDuration } = require('../shared/songTiming');
const { getSetting } = require('../shared/playbackDefaults');

const MAX_TIMEOUT_MS = 2147483647; // setTimeout limit

// Milliseconds until the playing song is over (incl. the configured delay),
// or null if nothing should happen.
function msUntilAutoNext(playback, songs, now) {
  if (!playback || playback.status !== 'playing') return null;
  if (getSetting(playback, 'autoNextSong') === false) return null;
  const song = songs.find((s) => s.id === playback.songId);
  if (!song) return null;
  const lines = computeLinesWithTimes(song);
  if (!lines.length) return null;
  const delay = Math.max(0, Number(getSetting(playback, 'autoNextDelaySeconds')) || 0);
  const elapsed = (Number(playback.anchorElapsed) || 0) + (now - (Number(playback.anchorEpoch) || now)) / 1000;
  return Math.max(0, (getSongDuration(lines) + delay - elapsed) * 1000);
}

// Playback after the current song ended: the next song, stopped at its start.
// null for the last song of the list (nothing to advance to).
function nextSongPlayback(playback, songs, now) {
  const idx = songs.findIndex((s) => s.id === playback.songId);
  if (idx === -1 || idx >= songs.length - 1) return null;
  return {
    ...playback,
    songId: songs[idx + 1].id,
    status: 'stopped',
    anchorElapsed: 0,
    anchorEpoch: now,
    updatedAt: now,
  };
}

// `reschedule()` must be called whenever playback or songs change.
function createAutoNext({ getPlayback, getSongs, applyPlayback }) {
  let timer = null;

  function reschedule() {
    clearTimeout(timer);
    timer = null;
    const ms = msUntilAutoNext(getPlayback(), getSongs(), Date.now());
    if (ms === null) return;
    timer = setTimeout(() => {
      timer = null;
      // Re-check: only act if the song is really over now
      const remaining = msUntilAutoNext(getPlayback(), getSongs(), Date.now());
      if (remaining === null) return;
      if (remaining > 50) {
        reschedule();
        return;
      }
      const next = nextSongPlayback(getPlayback(), getSongs(), Date.now());
      if (next) applyPlayback(next);
    }, Math.min(ms, MAX_TIMEOUT_MS));
  }

  return { reschedule };
}

module.exports = { createAutoNext, msUntilAutoNext, nextSongPlayback };
