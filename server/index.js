const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

// Version info generated at build time by scripts/generate-version.js
function loadVersionInfo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'version.json'), 'utf8'));
  } catch (e) {
    return { version: 'unbekannt', build: null, commit: null, builtAt: null };
  }
}
const VERSION_INFO = loadVersionInfo();

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
const SONGS_FILE = path.join(DATA_DIR, 'songs.json');
const PLAYBACK_FILE = path.join(DATA_DIR, 'playback.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const LEGACY_STATE_FILE = path.join(DATA_DIR, 'state.json');
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

// Stage settings that can be overridden per player (see players[id].stageSettings)
const PLAYER_STAGE_SETTING_LIMITS = {
  stageFontSize: [20, 120],
  stageCommentWidthPercent: [0, 100],
  stagePositionY: [-50, 50],
};

function sanitizeStageSettings(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(PLAYER_STAGE_SETTING_LIMITS)) {
    const value = Number(input[key]);
    if (input[key] === null || input[key] === undefined || input[key] === '' || !Number.isFinite(value)) continue;
    const [min, max] = PLAYER_STAGE_SETTING_LIMITS[key];
    out[key] = Math.min(max, Math.max(min, value));
  }
  return out;
}

const DEMO_SONG = {
  id: 'demo-1',
  title: 'Demo-Song (Platzhalter)',
  bpm: 84,
  timingMode: 'bar_beat',
  lines: [
    { id: 'l1', en: 'This is the first line of the demo', de: 'Dies ist die erste Zeile der Demo', mode: 'bar_beat', bar: 1, beat: 1 },
    { id: 'l2', en: 'Edit these lines in the song editor', de: 'Bearbeite diese Zeilen im Song-Editor', mode: 'bar_beat', bar: 3, beat: 1 },
    { id: 'l3', en: 'Timing can use seconds or beat numbers', de: 'Die Zeit kann in Sekunden oder Taktschlägen angegeben werden', mode: 'bar_beat', bar: 5, beat: 3 },
    { id: 'l4', en: 'Tap a line on the control screen to jump there', de: 'Tippe auf der Steuerung eine Zeile an, um dorthin zu springen', mode: 'bar_beat', bar: 7, beat: 1 },
  ],
};

function loadState() {
  let songs = null;
  let playback = null;
  let players = null;

  // Try reading independent files
  try {
    if (fs.existsSync(SONGS_FILE)) {
      const raw = fs.readFileSync(SONGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) songs = parsed;
    }
  } catch (e) {
    console.error('Fehler beim Laden von songs.json:', e.message);
  }

  try {
    if (fs.existsSync(PLAYBACK_FILE)) {
      const raw = fs.readFileSync(PLAYBACK_FILE, 'utf8');
      playback = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Fehler beim Laden von playback.json:', e.message);
  }

  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      const raw = fs.readFileSync(PLAYERS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) players = parsed;
    }
  } catch (e) {
    console.error('Fehler beim Laden von players.json:', e.message);
  }

  // Backwards compatibility: if any file is missing, check legacy state.json
  if ((songs === null || playback === null || players === null) && fs.existsSync(LEGACY_STATE_FILE)) {
    try {
      const legacyRaw = fs.readFileSync(LEGACY_STATE_FILE, 'utf8');
      const legacyParsed = JSON.parse(legacyRaw);
      if (songs === null && Array.isArray(legacyParsed.songs)) {
        songs = legacyParsed.songs;
      }
      if (playback === null && legacyParsed.playback) {
        playback = legacyParsed.playback;
      }
      if (players === null && typeof legacyParsed.players === 'object' && legacyParsed.players !== null) {
        players = legacyParsed.players;
      }
    } catch (e) {
      console.error('Fehler beim Laden von legacy state.json:', e.message);
    }
  }

  return {
    songs: songs !== null ? songs : [DEMO_SONG],
    playback: playback !== null ? playback : defaultPlayback(),
    players: players !== null ? players : {},
  };
}

let state = loadState();
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    try {
      fs.writeFileSync(SONGS_FILE, JSON.stringify(state.songs, null, 2));
      fs.writeFileSync(PLAYBACK_FILE, JSON.stringify(state.playback, null, 2));
      fs.writeFileSync(PLAYERS_FILE, JSON.stringify(state.players, null, 2));
    } catch (e) {
      console.error('Fehler beim Speichern der Daten:', e.message);
    }
  }, 150);
}

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.get('/healthz', (req, res) => res.json({ ok: true, version: VERSION_INFO.version }));
app.get('/api/version', (req, res) => res.json(VERSION_INFO));

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

// Keepalive heartbeat every 15 seconds to prevent mobile / NAT / firewall timeouts
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) {
      return client.terminate();
    }
    client.isAlive = false;
    try { client.ping(); } catch (e) {}
    try {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'ping' }));
      }
    } catch (e) {}
  });
}, 15000);

wss.on('close', () => clearInterval(heartbeatInterval));

wss.on('connection', (ws) => {
  let boundPlayerId = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.send(JSON.stringify({
    type: 'state',
    songs: state.songs,
    playback: state.playback,
    players: state.players,
    serverIp: getLocalIpAddress(),
    serverPort: PORT,
    serverNow: Date.now(),
    serverVersion: VERSION_INFO.version
  }));

  ws.on('message', (raw) => {
    ws.isAlive = true;
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'ping') {
      // Echo the client's send time plus our clock so clients can sync to server time
      try { ws.send(JSON.stringify({ type: 'pong', t0: msg.t0, serverNow: Date.now() })); } catch (e) {}
      if (boundPlayerId && state.players[boundPlayerId]) {
        state.players[boundPlayerId].lastSeen = Date.now();
      }
      return;
    }

    if (msg.type === 'pong') {
      if (boundPlayerId && state.players[boundPlayerId]) {
        state.players[boundPlayerId].lastSeen = Date.now();
      }
      return;
    }

    if (msg.type === 'registerPlayer' && msg.playerId) {
      boundPlayerId = msg.playerId;
      const existing = state.players[boundPlayerId] || {};
      state.players[boundPlayerId] = {
        ...existing,
        id: boundPlayerId,
        role: existing.role || null,
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

    if (msg.type === 'setPlayerName' && msg.playerId && state.players[msg.playerId]) {
      const name = typeof msg.name === 'string' ? msg.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
      const next = { ...state.players[msg.playerId] };
      if (name) next.name = name;
      else delete next.name;
      state.players[msg.playerId] = next;
      persist();
      broadcast({ type: 'players', players: state.players });
    }

    if (msg.type === 'setPlayerStageSettings' && msg.playerId && state.players[msg.playerId]) {
      const stageSettings = sanitizeStageSettings(msg.stageSettings);
      const next = { ...state.players[msg.playerId] };
      if (Object.keys(stageSettings).length) next.stageSettings = stageSettings;
      else delete next.stageSettings;
      state.players[msg.playerId] = next;
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
  console.log(`Autolyrics ${VERSION_INFO.version}${VERSION_INFO.commit ? ` (${VERSION_INFO.commit})` : ''} läuft auf Port ${PORT}`);
  console.log(`Daten werden gespeichert in: ${DATA_DIR} (songs.json, playback.json, players.json)`);
});
