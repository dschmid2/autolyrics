import { useMemo } from 'react';
import { sortedLines } from '../lib/timing';

// The song selected in playback plus its lines with absolute times (sorted)
export function useCurrentSong(songs, playback) {
  const song = useMemo(() => songs.find((s) => s.id === playback.songId) || null, [songs, playback.songId]);
  const lines = useMemo(() => (song ? sortedLines(song) : []), [song]);
  return { song, lines };
}
