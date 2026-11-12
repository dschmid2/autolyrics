import { serverNow } from './clock';
import { createDefaultPlayback } from '../../shared/playbackDefaults';
import { STAGE_SETTING_LIMITS } from '../../shared/stageSettings';

export { PLAYBACK_DEFAULTS, getSetting } from '../../shared/playbackDefaults';
export { applyStageSettings as applyPlayerStageSettings } from '../../shared/stageSettings';

export function defaultPlayback() {
  return createDefaultPlayback(serverNow(), Date.now());
}

export function computeElapsed(playback) {
  if (playback.status === 'playing') {
    return playback.anchorElapsed + (serverNow() - playback.anchorEpoch) / 1000;
  }
  return playback.anchorElapsed;
}

// UI description of the per-player stage settings (limits come from shared/)
const STAGE_SETTING_UI = {
  stageFontSize: { label: 'Schriftgrösse', format: (v) => `${v}px` },
  stageCommentWidthPercent: { label: 'Breite Kommentarspalte', format: (v) => `${v}%` },
  stagePositionY: { label: 'Vertikale Position', format: (v) => `${v > 0 ? '+' : ''}${v}%` },
};

export const PLAYER_STAGE_SETTINGS = Object.keys(STAGE_SETTING_LIMITS).map((key) => ({
  key,
  ...STAGE_SETTING_LIMITS[key],
  ...STAGE_SETTING_UI[key],
}));

// New playback object with `patch` applied and a fresh time anchor. Every
// change of status or position must go through this so that anchorEpoch is
// always in server time.
export function withAnchor(playback, patch) {
  return { ...playback, ...patch, anchorEpoch: serverNow() };
}
