// Shared between server (require) and React client (import via esbuild).
// public/legacy.js cannot import modules and keeps its own copy of these
// defaults in `state.playback` — keep it in sync.

// Display settings stored in playback.json, with their default values
const PLAYBACK_DEFAULTS = Object.freeze({
  fontSize: 64,
  stageFontSize: 64,
  translationPercent: 60,
  translationSpacing: 24,
  positionX: 50,
  positionY: 50,
  liveWidthPercent: 100,
  liveTextAlign: 'center',
  showHeartbeat: true,
  stagePastLines: 2,
  stageFutureLines: 2,
  stageLeadSeconds: 0,
  stageCommentWidthPercent: 20,
  stageLineSpacing: 24,
  stagePositionY: 0,
  stageShowTitle: false,
  // After a song has finished, load the next one (server/autoNext.js)
  autoNextSong: true,
  autoNextDelaySeconds: 3,
});

// Full initial playback object. `anchorEpoch` must be in server time.
function createDefaultPlayback(anchorEpoch, updatedAt) {
  return {
    songId: null,
    status: 'stopped',
    anchorEpoch,
    anchorElapsed: 0,
    updatedAt,
    ...PLAYBACK_DEFAULTS,
  };
}

// Value of a display setting, falling back to its default when missing
function getSetting(playback, key) {
  const value = playback ? playback[key] : undefined;
  return value !== undefined ? value : PLAYBACK_DEFAULTS[key];
}

module.exports = { PLAYBACK_DEFAULTS, createDefaultPlayback, getSetting };
