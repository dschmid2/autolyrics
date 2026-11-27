// Sync between Autolyrics instances:
//  * GET  /api/export        -> this instance's song package (audio via /uploads/<file>)
//  * POST /api/sync/preview  -> compare another instance's songs with ours
//  * POST /api/sync/import   -> pull songs (and optionally audio) from another instance
// The pulling instance does the HTTP requests server-side, because the audio
// files have to end up in its own uploads directory.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const {
  buildExport, parseExport, normalizeInstanceUrl, audioFileName, compareSongs, mergeSongs,
} = require('./songSync');

const JSON_TIMEOUT_MS = 15000;
const AUDIO_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // same limit as /api/upload

function describeFetchError(err, origin) {
  if (err && err.userMessage) return err.userMessage;
  if (err && err.name === 'TimeoutError') return `Zeitüberschreitung bei ${origin}.`;
  return `Keine Verbindung zu ${origin} möglich. Adresse und Netzwerk prüfen.`;
}

function userError(message) {
  const err = new Error(message);
  err.userMessage = message;
  return err;
}

async function fetchRemoteSongs(origin) {
  let res;
  try {
    res = await fetch(`${origin}/api/export`, { signal: AbortSignal.timeout(JSON_TIMEOUT_MS), redirect: 'error' });
  } catch (err) {
    throw userError(describeFetchError(err, origin));
  }
  if (res.status === 404) {
    throw userError('Die andere Instanz bietet kein Songpaket an (Autolyrics dort zu alt?).');
  }
  if (!res.ok) throw userError(`Die andere Instanz antwortet mit Fehler ${res.status}.`);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw userError('Die Antwort ist kein Autolyrics-Songpaket.');
  }
  try {
    return { songs: parseExport(data), appVersion: data.appVersion || null };
  } catch (err) {
    throw userError(err.message);
  }
}

// Downloads one audio file into uploadsDir (via a temp file, so a broken
// transfer never leaves a half-written MP3 behind)
async function downloadAudio(origin, fileName, uploadsDir) {
  const target = path.join(uploadsDir, fileName);
  const tmp = `${target}.part-${process.pid}`;
  const res = await fetch(`${origin}/uploads/${encodeURIComponent(fileName)}`, {
    signal: AbortSignal.timeout(AUDIO_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!res.ok || !res.body) throw new Error(`Fehler ${res.status}`);
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, enc, cb) {
      bytes += chunk.length;
      cb(bytes > MAX_AUDIO_BYTES ? new Error('Datei zu gross') : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body), limit, fs.createWriteStream(tmp));
    fs.renameSync(tmp, target);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch (e) {}
    throw err;
  }
}

function registerSyncRoutes(app, { getSongs, setSongs, uploadsDir, versionInfo }) {
  const hasLocalAudioFile = (fileName) => fs.existsSync(path.join(uploadsDir, fileName));
  const json = express.json({ limit: '1mb' });
  let importRunning = false;

  app.get('/api/export', (req, res) => {
    res.json(buildExport(getSongs(), versionInfo));
  });

  app.post('/api/sync/preview', json, async (req, res) => {
    try {
      const origin = normalizeInstanceUrl(req.body && req.body.url);
      const remote = await fetchRemoteSongs(origin);
      res.json({
        origin,
        appVersion: remote.appVersion,
        songs: compareSongs(getSongs(), remote.songs, hasLocalAudioFile),
      });
    } catch (err) {
      res.status(400).json({ error: err.userMessage || err.message });
    }
  });

  app.post('/api/sync/import', json, async (req, res) => {
    if (importRunning) {
      res.status(409).json({ error: 'Es läuft bereits ein Import.' });
      return;
    }
    importRunning = true;
    try {
      const body = req.body || {};
      const origin = normalizeInstanceUrl(body.url);
      const includeAudio = body.includeAudio !== false;
      const selectedIds = Array.isArray(body.songIds) ? body.songIds.filter((id) => typeof id === 'string') : null;
      const remote = await fetchRemoteSongs(origin);
      const selected = selectedIds ? new Set(selectedIds) : null;

      // 1. Audio first, so songs never point to files that are not there yet
      const audioDownloaded = [];
      const audioFailed = [];
      if (includeAudio) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        const wanted = new Set();
        remote.songs.forEach((s) => {
          const fileName = audioFileName(s.audioUrl);
          if (fileName && (!selected || selected.has(s.id)) && !hasLocalAudioFile(fileName)) wanted.add(fileName);
        });
        for (const fileName of wanted) {
          try {
            await downloadAudio(origin, fileName, uploadsDir);
            audioDownloaded.push(fileName);
          } catch (err) {
            audioFailed.push({ fileName, error: err.message });
          }
        }
      }

      // 2. Merge. A song links to the remote's audio file if that file exists
      //    here; otherwise it keeps the audio it already had locally (if any).
      let audioMissing = 0;
      const resolveAudio = (remoteSong, localSong) => {
        const fileName = audioFileName(remoteSong.audioUrl);
        if (fileName && hasLocalAudioFile(fileName)) {
          return { audioUrl: `/uploads/${fileName}`, audioName: remoteSong.audioName || fileName };
        }
        if (fileName) audioMissing++;
        if (localSong && localSong.audioUrl) {
          return { audioUrl: localSong.audioUrl, audioName: localSong.audioName };
        }
        return {};
      };
      const result = mergeSongs(getSongs(), remote.songs, selectedIds, resolveAudio);
      setSongs(result.songs);

      res.json({
        origin,
        added: result.added,
        updated: result.updated,
        audioDownloaded: audioDownloaded.length,
        audioFailed,
        audioMissing,
        total: result.songs.length,
      });
    } catch (err) {
      res.status(400).json({ error: err.userMessage || err.message });
    } finally {
      importRunning = false;
    }
  });
}

module.exports = { registerSyncRoutes };
