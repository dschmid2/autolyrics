const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');

function defaultPlayback() {
  return {
    songId: null,
    status: 'stopped',
    anchorEpoch: Date.now(),
    anchorElapsed: 0,
    updatedAt: Date.now(),
    fontSize: 64,
    translationPercent: 60,
    positionX: 50,
    positionY: 50,
    showHeartbeat: true,
    stagePastLines: 2,
    stageFutureLines: 2
  };
}

const DEMO_SONG = {
  id: 'demo-1',
  title: 'Demo-Song (Platzhalter)',
  bpm: 84,
  lines: [
    { id: 'l1', en: 'This is the first line of the demo', de: 'Dies ist die erste Zeile der Demo', mode: 'sec', timeSec: 0, beat: '' },
    { id: 'l2', en: 'Edit these lines in the song editor', de: 'Bearbeite diese Zeilen im Song-Editor', mode: 'sec', timeSec: 6, beat: '' },
    { id: 'l3', en: 'Timing can use seconds or beat numbers', de: 'Die Zeit kann in Sekunden oder Taktschlägen angegeben werden', mode: 'beat', timeSec: '', beat: 13 },
    { id: 'l4', en: 'Tap a line on the control screen to jump there', de: 'Tippe auf der Steuerung eine Zeile an, um dorthin zu springen', mode: 'sec', timeSec: 18, beat: '' },
  ],
};

function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      songs: Array.isArray(parsed.songs) ? parsed.songs : [DEMO_SONG],
      playback: parsed.playback || defaultPlayback(),
    };
  } catch (e) {
    return { songs: [DEMO_SONG], playback: defaultPlayback() };
  }
}

let state = loadState();
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  }, 150);
}

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/healthz', (req, res) => res.json({ ok: true }));

// Routing for direct access to /live and /stage
app.get(['/live', '/stage'], (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg, exceptWs) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client !== exceptWs) client.send(data);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', songs: state.songs, playback: state.playback }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'setSongs' && Array.isArray(msg.songs)) {
      state.songs = msg.songs;
      persist();
      broadcast({ type: 'songs', songs: state.songs }, ws);
    }
    if (msg.type === 'setPlayback' && msg.playback) {
      state.playback = { ...msg.playback, updatedAt: Date.now() };
      persist();
      broadcast({ type: 'playback', playback: state.playback }, ws);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Autolyrics läuft auf Port ${PORT}`);
  console.log(`Daten werden gespeichert unter: ${DATA_FILE}`);
});
