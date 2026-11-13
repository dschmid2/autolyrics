import { computeElapsed, withAnchor } from '../lib/playback';

// Transport commands (load, play/pause, stop, seek) for the operator views.
// `source: 'control'` marks live operation: only then the server loads the next
// song automatically at the end (the editor's "send to screens" uses 'editor').
export function usePlaybackControls(playback, sendPlayback) {
  const send = (patch) => sendPlayback(withAnchor(playback, { ...patch, source: 'control' }));
  const seekTo = (sec) => send({ anchorElapsed: Math.max(0, sec) });

  return {
    loadSong: (song) => send({ songId: song.id, status: 'stopped', anchorElapsed: 0 }),
    togglePlay: () => {
      if (playback.status === 'playing') {
        send({ status: 'paused', anchorElapsed: computeElapsed(playback) });
      } else {
        send({ status: 'playing' });
      }
    },
    stop: () => send({ status: 'stopped', anchorElapsed: 0 }),
    seekTo,
    nudge: (delta) => seekTo(computeElapsed(playback) + delta),
    playFrom: (sec) => send({ status: 'playing', anchorElapsed: Math.max(0, sec) }),
  };
}
