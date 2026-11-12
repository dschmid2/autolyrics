// Stage settings that can be overridden per player (players[id].stageSettings).
// Shared between server (validation) and React client (UI + merge).
// public/legacy.js keeps its own key list (PLAYER_STAGE_SETTING_KEYS).

const STAGE_SETTING_LIMITS = Object.freeze({
  stageFontSize: { min: 20, max: 120, step: 1 },
  stageCommentWidthPercent: { min: 0, max: 100, step: 1 },
  stagePositionY: { min: -50, max: 50, step: 1 },
});

const STAGE_SETTING_KEYS = Object.keys(STAGE_SETTING_LIMITS);

// Keeps only known keys with finite numbers, clamped to their limits
function sanitizeStageSettings(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of STAGE_SETTING_KEYS) {
    const value = Number(input[key]);
    if (input[key] === null || input[key] === undefined || input[key] === '' || !Number.isFinite(value)) continue;
    const { min, max } = STAGE_SETTING_LIMITS[key];
    out[key] = Math.min(max, Math.max(min, value));
  }
  return out;
}

// Playback with the overrides of one player applied
function applyStageSettings(playback, stageSettings) {
  if (!stageSettings) return playback;
  const merged = { ...playback };
  STAGE_SETTING_KEYS.forEach((key) => {
    if (stageSettings[key] !== undefined && stageSettings[key] !== null) merged[key] = stageSettings[key];
  });
  return merged;
}

module.exports = { STAGE_SETTING_LIMITS, STAGE_SETTING_KEYS, sanitizeStageSettings, applyStageSettings };
