import { serverNow } from './clock';

export function defaultPlayback() {
  return {
    songId: null,
    status: 'stopped',
    anchorEpoch: serverNow(),
    anchorElapsed: 0,
    updatedAt: Date.now(),
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
    stageShowTitle: false
  };
}

export function computeElapsed(playback) {
  if (playback.status === 'playing') {
    return playback.anchorElapsed + (serverNow() - playback.anchorEpoch) / 1000;
  }
  return playback.anchorElapsed;
}

// A player can override some stage settings (players[id].stageSettings). Keys
// that are missing fall back to the global value in playback.
export const PLAYER_STAGE_SETTINGS = [
  { key: 'stageFontSize', label: 'Schriftgrösse', min: 20, max: 120, step: 1, fallback: 64, format: (v) => `${v}px` },
  { key: 'stageCommentWidthPercent', label: 'Breite Kommentarspalte', min: 0, max: 100, step: 1, fallback: 20, format: (v) => `${v}%` },
  { key: 'stagePositionY', label: 'Vertikale Position', min: -50, max: 50, step: 1, fallback: 0, format: (v) => `${v > 0 ? '+' : ''}${v}%` },
];

export function applyPlayerStageSettings(playback, stageSettings) {
  if (!stageSettings) return playback;
  const merged = { ...playback };
  PLAYER_STAGE_SETTINGS.forEach(({ key }) => {
    if (stageSettings[key] !== undefined && stageSettings[key] !== null) merged[key] = stageSettings[key];
  });
  return merged;
}
