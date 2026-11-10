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
    stagePositionY: 0
  };
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
  let legacyData = null;
  if (fs.existsSync(LEGACY_STATE_FILE)) {
    try {
      legacyData = JSON.parse(fs.readFileSync(LEGACY_STATE_FILE, 'utf8'));
    } catch (e) {
      console.warn('Fehler beim Lesen der Legacy-Datei state.json:', e.message);
    }
  }

  let songs = null;
  if (fs.existsSync(SONGS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SONGS_FILE, 'utf8'));
      if (Array.isArray(parsed)) songs = parsed;
    } catch (e) {
      console.warn('Fehler beim Lesen von songs.json:', e.message);
    }
  }
  if (!songs) {
    if (legacyData && Array.isArray(legacyData.songs)) {
      songs = legacyData.songs;
    } else {
      songs = [DEMO_SONG];
    }
  }

  let playback = null;
  if (fs.existsSync(PLAYBACK_FILE)) {
    try {
      playback = JSON.parse(fs.readFileSync(PLAYBACK_FILE, 'utf8'));
    } catch (e) {
      console.warn('Fehler beim Lesen von playback.json:', e.message);
    }
  }
  if (!playback) {
    if (legacyData && legacyData.playback) {
      playback = legacyData.playback;
    } else {
      playback = defaultPlayback();
    }
  }

  let players = null;
  if (fs.existsSync(PLAYERS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null) players = parsed;
    } catch (e) {
      console.warn('Fehler beim Lesen von players.json:', e.message);
    }
  }
  if (!players) {
    if (legacyData && typeof legacyData.players === 'object' && legacyData.players !== null) {
      players = legacyData.players;
    } else {
      players = {};
    }
  }

  return { songs, playback, players };
}

let state = loadState();

let saveTimers = {
  songs: null,
  playback: null,
  players: null
};

function persistSongs() {
  clearTimeout(saveTimers.songs);
  saveTimers.songs = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(SONGS_FILE, JSON.stringify(state.songs, null, 2));
    } catch (e) {
      console.error('Fehler beim Schreiben von songs.json:', e.message);
    }
  }, 150);
}

function persistPlayback() {
  clearTimeout(saveTimers.playback);
  saveTimers.playback = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(PLAYBACK_FILE, JSON.stringify(state.playback, null, 2));
    } catch (e) {
      console.error('Fehler beim Schreiben von playback.json:', e.message);
    }
  }, 150);
}

function persistPlayers() {
  clearTimeout(saveTimers.players);
  saveTimers.players = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(PLAYERS_FILE, JSON.stringify(state.players, null, 2));
    } catch (e) {
      console.error('Fehler beim Schreiben von players.json:', e.message);
    }
  }, 150);
}

function persistAll() {
  persistSongs();
  persistPlayback();
  persistPlayers();
}

// Initial write if files do not exist yet (e.g. migration from state.json or fresh start)
if (!fs.existsSync(SONGS_FILE)) persistSongs();
if (!fs.existsSync(PLAYBACK_FILE)) persistPlayback();
if (!fs.existsSync(PLAYERS_FILE)) persistPlayers();

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
    serverPort: PORT
  }));

  ws.on('message', (raw) => {
    ws.isAlive = true;
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === 'ping') {
      try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) {}
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
      const existingRole = state.players[boundPlayerId] ? state.players[boundPlayerId].role : null;
      state.players[boundPlayerId] = {
        id: boundPlayerId,
        role: existingRole || null,
        lastSeen: Date.now(),
        online: true,
      };
      persistPlayers();
      broadcast({ type: 'players', players: state.players });
    }

    if (msg.type === 'setPlayerRole' && msg.playerId) {
      const existing = state.players[msg.playerId] || { id: msg.playerId, online: false };
      state.players[msg.playerId] = {
        ...existing,
        role: msg.role || null,
        lastSeen: Date.now(),
      };
      persistPlayers();
      broadcast({ type: 'players', players: state.players });
    }

    if (msg.type === 'deletePlayer' && msg.playerId) {
      delete state.players[msg.playerId];
      persistPlayers();
      broadcast({ type: 'players', players: state.players });
    }

    if (msg.type === 'setSongs' && Array.isArray(msg.songs)) {
      state.songs = msg.songs;
      persistSongs();
      broadcast({ type: 'songs', songs: state.songs }, ws);
    }
    if (msg.type === 'setPlayback' && msg.playback) {
      state.playback = { ...msg.playback, updatedAt: Date.now() };
      persistPlayback();
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
      persistPlayers();
      broadcast({ type: 'players', players: state.players });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Autolyrics läuft auf Port ${PORT}`);
  console.log(`Daten werden gespeichert im Verzeichnis: ${DATA_DIR}`);
});
