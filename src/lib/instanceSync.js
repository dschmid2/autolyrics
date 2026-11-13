// Client for the server-side instance sync (see server/sync.js)

const URL_KEY = 'autolyrics_sync_url';

export function loadSyncUrl() {
  try {
    return localStorage.getItem(URL_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function saveSyncUrl(url) {
  try {
    localStorage.setItem(URL_KEY, url);
  } catch (e) {}
}

async function post(path, body) {
  let res;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('Keine Verbindung zum eigenen Server.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || `Fehler ${res.status}`);
  return data;
}

// Compares the songs of the instance at `url` with the local ones
export function previewSync(url) {
  return post('/api/sync/preview', { url });
}

// Imports the songs with the given ids (and their audio files if wanted)
export function importFromInstance(url, songIds, includeAudio) {
  return post('/api/sync/import', { url, songIds, includeAudio });
}
