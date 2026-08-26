const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${safeName}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

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
    stageFutureLines: 2,
    stageLeadSeconds: 0
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
      players: typeof parsed.players === 'object' && parsed.players !== null ? parsed.players : {},
    };
  } catch (e) {
    return { songs: [DEMO_SONG], playback: defaultPlayback(), players: {} };
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
app.use('/uploads', express.static(UPLOADS_DIR));
app.get('/healthz', (req, res) => res.json({ ok: true }));

app.post('/api/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  }
  const audioUrl = `/uploads/${req.file.filename}`;
  res.json({ url: audioUrl, filename: req.file.filename, originalName: req.file.originalname });
});

// Routing for direct access to /live, /stage, and /player
app.get(['/live', '/stage', '/player'], (req, res) => {
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
  let boundPlayerId = null;

  ws.send(JSON.stringify({
    type: 'state',
    songs: state.songs,
    playback: state.playback,
    players: state.players,
    serverIp: getLocalIpAddress(),
    serverPort: PORT
  }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'registerPlayer' && msg.playerId) {
      boundPlayerId = msg.playerId;
      const existingRole = state.players[boundPlayerId] ? state.players[boundPlayerId].role : null;
      state.players[boundPlayerId] = {
        id: boundPlayerId,
        role: existingRole || null,
        lastSeen: Date.now(),
        online: true,
      };
      persist();
      broadcast({ type: 'players', players: state.players });
    }

    if (msg.type === 'setPlayerRole' && msg.playerId) {
      const existing = state.players[msg.playerId] || { id: msg.playerId, online: false };
      state.players[msg.playerId] = {
        ...existing,
        role: msg.role || null,
        lastSeen: Date.now(),
      };
      persist();
      broadcast({ type: 'players', players: state.players });
    }

    if (msg.type === 'deletePlayer' && msg.playerId) {
      delete state.players[msg.playerId];
      persist();
      broadcast({ type: 'players', players: state.players });
    }

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

  ws.on('close', () => {
    if (boundPlayerId && state.players[boundPlayerId]) {
      state.players[boundPlayerId] = {
        ...state.players[boundPlayerId],
        online: false,
        lastSeen: Date.now(),
      };
      persist();
      broadcast({ type: 'players', players: state.players });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Autolyrics läuft auf Port ${PORT}`);
  console.log(`Daten werden gespeichert unter: ${DATA_FILE}`);
});
