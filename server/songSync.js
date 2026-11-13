// Pure helpers for syncing songs between Autolyrics instances (no I/O).
const path = require('path');

const EXPORT_FORMAT = 'autolyrics-songs';
const EXPORT_FORMAT_VERSION = 1;

// Song package offered by GET /api/export
function buildExport(songs, versionInfo) {
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    appVersion: versionInfo && versionInfo.version,
    exportedAt: new Date().toISOString(),
    songs,
  };
}

// Returns the songs of a package, or throws with a German message
function parseExport(data) {
  if (!data || data.format !== EXPORT_FORMAT || !Array.isArray(data.songs)) {
    throw new Error('Die Antwort ist kein Autolyrics-Songpaket.');
  }
  if (Number(data.formatVersion) > EXPORT_FORMAT_VERSION) {
    throw new Error('Die andere Instanz ist neuer als diese. Bitte zuerst diese Instanz aktualisieren.');
  }
  return data.songs.filter((s) => s && typeof s === 'object' && typeof s.id === 'string' && s.id);
}

// "http://nas:8080", "nas.local:8080/", "192.168.1.5:8080/editor" -> "http://host:port"
function normalizeInstanceUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new Error('Bitte die Adresse der anderen Instanz angeben.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'http://' + raw;
  let url;
  try {
    url = new URL(raw);
  } catch (e) {
    throw new Error('Die Adresse ist ungültig.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Nur http:// und https:// werden unterstützt.');
  }
  return url.origin;
}

// File name of an uploaded audio file ("/uploads/123_song.mp3" -> "123_song.mp3"),
// or null if the URL does not point to a plain file in /uploads/
function audioFileName(audioUrl) {
  if (typeof audioUrl !== 'string' || !audioUrl.startsWith('/uploads/')) return null;
  let name;
  try {
    name = decodeURIComponent(audioUrl.slice('/uploads/'.length));
  } catch (e) {
    return null;
  }
  if (!name || name !== path.basename(name) || name.startsWith('.') || /[\\/\0]/.test(name)) return null;
  return name;
}

// Stable JSON (sorted keys) so that key order does not count as a change
function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value === undefined ? null : value);
}

// Song content without the audio link (which is local to each instance)
function contentOf(song) {
  const { audioUrl, audioName, ...rest } = song;
  return stableStringify(rest);
}

// Compares remote songs with local ones.
// status: 'new' (unknown id), 'changed' (known id, different content), 'same'
// audio:  'none' | 'local' (file already here) | 'missing' (would be downloaded)
function compareSongs(localSongs, remoteSongs, hasLocalAudioFile) {
  const localById = new Map(localSongs.map((s) => [s.id, s]));
  return remoteSongs.map((remote) => {
    const local = localById.get(remote.id);
    const fileName = audioFileName(remote.audioUrl);
    return {
      id: remote.id,
      title: remote.title || '',
      lineCount: Array.isArray(remote.lines) ? remote.lines.length : 0,
      status: !local ? 'new' : contentOf(local) === contentOf(remote) ? 'same' : 'changed',
      audio: !fileName ? 'none' : hasLocalAudioFile(fileName) ? 'local' : 'missing',
      audioName: fileName ? (remote.audioName || fileName) : null,
    };
  });
}

// Merges the selected remote songs into the local list: known ids are updated
// in place, unknown ids are appended, local-only songs are kept.
// `resolveAudio(remoteSong, localSong)` returns the { audioUrl, audioName } to
// store locally (or {} for none).
function mergeSongs(localSongs, remoteSongs, selectedIds, resolveAudio) {
  const selected = selectedIds ? new Set(selectedIds) : null;
  const incoming = remoteSongs.filter((s) => !selected || selected.has(s.id));
  const incomingById = new Map(incoming.map((s) => [s.id, s]));
  const localIds = new Set(localSongs.map((s) => s.id));
  const withAudio = (remote, local) => {
    const { audioUrl, audioName, ...rest } = remote;
    return { ...rest, ...resolveAudio(remote, local) };
  };

  // Only songs that really differ afterwards count as updated
  let updated = 0;
  const merged = localSongs.map((local) => {
    const remote = incomingById.get(local.id);
    if (!remote) return local;
    const next = withAudio(remote, local);
    if (stableStringify(next) === stableStringify(local)) return local;
    updated++;
    return next;
  });
  const added = incoming.filter((s) => !localIds.has(s.id));
  added.forEach((remote) => merged.push(withAudio(remote, null)));

  return { songs: merged, added: added.length, updated };
}

module.exports = {
  EXPORT_FORMAT, EXPORT_FORMAT_VERSION,
  buildExport, parseExport, normalizeInstanceUrl, audioFileName, compareSongs, mergeSongs,
};
