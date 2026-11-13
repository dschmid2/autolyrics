/* Autolyrics Legacy Client for older browsers (e.g. old iOS / Safari on iPad)
   Written strictly in ES5 without dependencies.
*/
(function() {
  'use strict';

  var COLORS = {
    stageBg: '#0A0A0D',
    stageText: '#F4EFE4',
    stageTextDim: '#9AA0AE',
    amber: '#D89A3E',
    danger: '#B5453A'
  };

  // State holder
  var state = {
    songs: [],
    playback: {
      songId: null,
      status: 'stopped',
      anchorEpoch: Date.now(),
      anchorElapsed: 0,
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
      stageShowTitle: false,
      autoNextSong: true,
      autoNextDelaySeconds: 3
    },
    players: {},
    serverVersion: null,
    connected: false,
    playerId: getOrCreatePlayerId()
  };

  var blackoutTimer = null;
  var isBlackout = false;

  // DOM elements cache
  var rootEl = document.getElementById('root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);
  }

  // Inject minimal CSS styles for animations and reset
  var styleEl = document.createElement('style');
  styleEl.type = 'text/css';
  styleEl.innerHTML = [
    'html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #0A0A0D; color: #F4EFE4; overflow: hidden; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
    '.legacy-cursor-none { cursor: none !important; }',
    '.legacy-connection-badge { position: fixed; top: 12px; left: 50%; -webkit-transform: translateX(-50%); transform: translateX(-50%); z-index: 9999; font-size: 12px; padding: 6px 14px; border-radius: 9999px; background: #B5453A; color: #ffffff; font-family: sans-serif; }',
    '.legacy-beat-dot { position: fixed; bottom: 24px; right: 24px; width: 12px; height: 12px; border-radius: 50%; background: #D89A3E; z-index: 1000; -webkit-animation-name: legacyPulse; animation-name: legacyPulse; -webkit-animation-iteration-count: infinite; animation-iteration-count: infinite; -webkit-animation-timing-function: ease-in-out; animation-timing-function: ease-in-out; }',
    '@-webkit-keyframes legacyPulse { 0% { -webkit-transform: scale(1); opacity: 0.15; } 15% { -webkit-transform: scale(1.8); opacity: 0.55; } 100% { -webkit-transform: scale(1); opacity: 0.15; } }',
    '@keyframes legacyPulse { 0% { transform: scale(1); opacity: 0.15; } 15% { transform: scale(1.8); opacity: 0.55; } 100% { transform: scale(1); opacity: 0.15; } }'
  ].join('\n');
  document.head.appendChild(styleEl);

  function generateGuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getOrCreatePlayerId() {
    try {
      var id = localStorage.getItem('autolyrics_player_id');
      if (!id) {
        id = generateGuid();
        localStorage.setItem('autolyrics_player_id', id);
      }
      return id;
    } catch (e) {
      return generateGuid();
    }
  }

  // --- Server clock sync (anchorEpoch is in server time, see src/lib/clock.js) ---
  var serverClockOffset = 0; // serverTime - localTime in ms
  var clockSamples = [];
  var MAX_CLOCK_SAMPLES = 8;

  function serverNow() {
    return Date.now() + serverClockOffset;
  }

  function recordClockSample(t0, serverTime) {
    var t1 = Date.now();
    var rtt = t1 - Number(t0);
    serverTime = Number(serverTime);
    if (isNaN(rtt) || isNaN(serverTime) || rtt < 0 || rtt > 10000) return;
    clockSamples.push({ rtt: rtt, offset: serverTime + rtt / 2 - t1 });
    if (clockSamples.length > MAX_CLOCK_SAMPLES) clockSamples.shift();
    var best = clockSamples[0];
    for (var i = 1; i < clockSamples.length; i++) {
      if (clockSamples[i].rtt < best.rtt) best = clockSamples[i];
    }
    serverClockOffset = best.offset;
  }

  function computeElapsed(playback) {
    if (playback && playback.status === 'playing') {
      return (Number(playback.anchorElapsed) || 0) + (serverNow() - (Number(playback.anchorEpoch) || serverNow())) / 1000;
    }
    return Number(playback && playback.anchorElapsed) || 0;
  }

  function computeLinesWithTimes(song) {
    if (!song || !song.lines || !(song.lines instanceof Array)) return [];
    var bpm = Number(song.bpm) || 90;
    var timeSigNum = Number(song.timeSigNum) || 4;
    var lines = [];
    var prevTime = 0;
    var defaultMode = song.timingMode || 'bar_beat';

    for (var i = 0; i < song.lines.length; i++) {
      var l = song.lines[i];
      var mode = l.mode || defaultMode;
      var t = 0;
      if (mode === 'sec') {
        t = Number(l.timeSec) || 0;
      } else if (mode === 'relative') {
        var rel = Number(l.relativeSec) || 0;
        t = prevTime + rel;
      } else if (mode === 'relative_bar_beat') {
        var relBar = Number(l.relativeBar) || 0;
        var relBeat = Number(l.relativeBeat) || 0;
        var totalBeatsRel = relBar * timeSigNum + relBeat;
        t = prevTime + totalBeatsRel * (60 / bpm);
      } else if (mode === 'bar_beat') {
        var bar = Number(l.bar) || 1;
        var beat = Number(l.beat) || 1;
        var totalBeatsBar = (bar - 1) * timeSigNum + (beat - 1);
        t = Math.max(0, totalBeatsBar * (60 / bpm));
      } else if (mode === 'beat') {
        var beatOnly = Number(l.beat) || 1;
        t = Math.max(0, (beatOnly - 1) * 60 / bpm);
      } else {
        t = Number(l.timeSec) || 0;
      }

      var duration = (l.duration !== undefined && l.duration !== null && l.duration !== '') ? Number(l.duration) : null;
      lines.push({
        id: l.id,
        en: l.en,
        de: l.de,
        comment: l.comment,
        stageOnly: !!l.stageOnly,
        mode: mode,
        t: t,
        duration: duration
      });
      prevTime = t;
    }

    return lines.sort(function(a, b) {
      return a.t - b.t;
    });
  }

  function getSongDuration(lines) {
    if (!lines || !lines.length) return 0;
    var lastLine = lines[lines.length - 1];
    var dur = (lastLine.duration !== null && lastLine.duration !== undefined && lastLine.duration !== '') ? Number(lastLine.duration) : 4;
    return lastLine.t + dur;
  }

  // Index of the last line whose start time has been reached (ignores durations), or -1
  function startedIndex(lines, elapsed) {
    if (!lines || !lines.length) return -1;
    var idx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].t <= elapsed + 0.05) idx = i;
      else break;
    }
    return idx;
  }

  function currentIndex(lines, elapsed) {
    if (!lines || !lines.length) return -1;
    var duration = getSongDuration(lines);
    if (elapsed >= duration) return -1;

    var idx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].t <= elapsed + 0.05) { // tolerance for clock sync error (see LINE_START_TOLERANCE in src/lib/timing.js)
        idx = i;
      } else {
        break;
      }
    }
    if (idx >= 0) {
      var line = lines[idx];
      if (line.duration !== null && line.duration !== undefined && line.duration !== '') {
        if (elapsed > line.t + Number(line.duration)) {
          return -1;
        }
      }
    }
    return idx;
  }

  function getCurrentView() {
    var path = window.location.pathname;
    if (path === '/live') return 'projection';
    if (path === '/stage') return 'stage';
    if (path === '/player') return 'player';
    return 'control';
  }

  function requestFullscreen(el) {
    var elem = el || document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  }

  // --- WebSocket Connection ---
  var ws = null;
  var reconnectTimer = null;
  var lastMessageTime = Date.now();
  var keepAliveInterval = null;

  function sendWsPing() {
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({ type: 'ping', t0: Date.now() }));
      } catch (e) {}
    }
  }

  function checkWatchdog() {
    if (ws && ws.readyState === 1 && Date.now() - lastMessageTime > 35000) {
      try { ws.close(); } catch (e) {}
    }
  }

  function checkAndReconnect() {
    var isConnecting = ws && ws.readyState === 0;
    var isOpen = ws && ws.readyState === 1;
    var isTimedOut = isOpen && (Date.now() - lastMessageTime > 25000);

    if (!isConnecting && (!isOpen || isTimedOut)) {
      if (ws) {
        try { ws.close(); } catch (e) {}
      }
      clearTimeout(reconnectTimer);
      connectWebSocket();
    }
  }

  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      checkAndReconnect();
    }
  });
  window.addEventListener('pageshow', checkAndReconnect);
  window.addEventListener('focus', checkAndReconnect);
  window.addEventListener('online', checkAndReconnect);

  if (!keepAliveInterval) {
    keepAliveInterval = setInterval(function() {
      sendWsPing();
      checkWatchdog();
    }, 10000);
  }

  function connectWebSocket() {
    clearTimeout(reconnectTimer);
    var proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    var wsUrl = proto + '://' + window.location.host + '/ws';

    var socket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (e) {
      reconnectTimer = setTimeout(connectWebSocket, 2000);
      return;
    }
    ws = socket;

    // Events of a replaced socket (e.g. after a forced reconnect on wake-up)
    // must be ignored, otherwise its late onclose opens yet another connection
    function isStale() {
      return socket !== ws;
    }

    socket.onopen = function() {
      if (isStale()) return;
      state.connected = true;
      lastMessageTime = Date.now();
      if (blackoutTimer) {
        clearTimeout(blackoutTimer);
        blackoutTimer = null;
      }
      isBlackout = false;
      render();
      try {
        ws.send(JSON.stringify({ type: 'registerPlayer', playerId: state.playerId }));
      } catch (e) {}
      // Quick burst of clock sync pings right after connecting
      clockSamples = [];
      var delays = [0, 250, 500, 1000, 2000];
      for (var d = 0; d < delays.length; d++) {
        setTimeout(sendWsPing, delays[d]);
      }
    };

    socket.onclose = function() {
      if (isStale()) return;
      state.connected = false;
      render();
      if (!blackoutTimer) {
        blackoutTimer = setTimeout(function() {
          isBlackout = true;
          render();
        }, 30000);
      }
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectWebSocket, 1500);
    };

    socket.onerror = function() {
      try { socket.close(); } catch (e) {}
    };

    socket.onmessage = function(ev) {
      if (isStale()) return;
      lastMessageTime = Date.now();
      try {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'ping') {
          try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) {}
          return;
        }
        if (msg.type === 'pong') {
          if (msg.t0 !== undefined && msg.serverNow !== undefined) recordClockSample(msg.t0, msg.serverNow);
          return;
        }
        if (msg.type === 'state') {
          if (msg.serverNow && clockSamples.length === 0) serverClockOffset = msg.serverNow - Date.now();
          if (msg.songs) state.songs = msg.songs;
          if (msg.playback) state.playback = msg.playback;
          if (msg.players) state.players = msg.players;
          if (msg.serverVersion) state.serverVersion = msg.serverVersion;
        } else if (msg.type === 'songs') {
          state.songs = msg.songs;
        } else if (msg.type === 'playback') {
          state.playback = msg.playback;
        } else if (msg.type === 'players') {
          state.players = msg.players;
        }
        render();
      } catch (e) {}
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- View Renderers ---

  // Writes the view into the DOM only if it changed. Rebuilding the DOM 60
  // times per second while playing caused memory pressure and page reloads
  // ("Ein Problem ist aufgetreten") on older iPads.
  var lastRootHtml = null;
  function setRootHtml(html) {
    if (html === lastRootHtml) return false;
    lastRootHtml = html;
    rootEl.innerHTML = html;
    return true;
  }

  function renderConnectionBadge() {
    if (state.connected) return '';
    return '<div class="legacy-connection-badge">Keine Verbindung zum Server – versuche erneut zu verbinden…</div>';
  }

  function renderHeartbeat(song, playback, isSongCompleted, isProjectionBlackout) {
    if (!song || playback.status !== 'playing' || playback.showHeartbeat === false) return '';
    if (isSongCompleted || isProjectionBlackout) return '';
    var pulseDuration = 60 / (song.bpm || 60);
    return '<div class="legacy-beat-dot" style="-webkit-animation-duration: ' + pulseDuration + 's; animation-duration: ' + pulseDuration + 's;"></div>';
  }

  function renderVersionInfo() {
    if (!state.serverVersion) return '';
    return '<div style="margin-top: 16px; font-size: 11px; font-family: monospace; color: #71717a;">v' + escapeHtml(state.serverVersion) + '</div>';
  }

  function renderPlayerUnassigned() {
    var localPlayer = state.players && state.players[state.playerId];
    var localName = localPlayer && localPlayer.name;
    var html = [
      renderConnectionBadge(),
      '<div style="min-height: 100vh; background: #09090b; display: -webkit-box; display: -webkit-flex; display: flex; -webkit-box-orient: vertical; -webkit-box-direction: normal; -webkit-flex-direction: column; flex-direction: column; -webkit-box-align: center; -webkit-align-items: center; align-items: center; -webkit-box-pack: center; -webkit-justify-content: center; justify-content: center; padding: 24px; text-align: center; box-sizing: border-box;">',
      '  <div style="max-width: 420px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px 24px; box-sizing: border-box; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">',
      '    <div style="font-size: 36px; margin-bottom: 16px;">📱</div>',
      '    <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: bold; color: #ffffff;">Player registriert</h2>',
      '    <div style="display: inline-block; font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(216, 154, 62, 0.2); color: #d89a3e; margin-bottom: 12px;">Legacy-Modus aktiv</div>',
      '    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #a1a1aa;">Zuweisung fehlt noch. Bitte in der Steuerung eine Rolle (Stage oder Live) zuweisen.</p>',
      '    <div style="background: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 14px 12px; margin-top: 16px;">',
      '      <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #71717a; margin-bottom: 6px;">Player ID</div>',
      '      <div style="font-size: 15px; font-family: monospace; font-weight: bold; color: #fbbf24; word-break: break-all;">' + escapeHtml(state.playerId) + '</div>',
      (localName ? '      <div style="font-size: 14px; font-weight: bold; color: #ffffff; padding-top: 4px;">' + escapeHtml(localName) + '</div>' : ''),
      '    </div>',
      renderVersionInfo(),
      '  </div>',
      '</div>'
    ].join('\n');
    if (!setRootHtml(html)) return;
  }

  var stageMeasuredHeights = {};
  var stageLastSongId = null;
  var stageLastFontSize = null;
  var stageLastSpacing = null;

  function renderStageView(song, playback, elapsed) {
    var lines = song ? sortedLines(song) : [];
    var stageLeadSeconds = playback.stageLeadSeconds !== undefined ? playback.stageLeadSeconds : 0;
    var stagePastLines = playback.stagePastLines !== undefined ? playback.stagePastLines : 2;
    var stageFutureLines = playback.stageFutureLines !== undefined ? playback.stageFutureLines : 2;
    var stageLineSpacing = playback.stageLineSpacing !== undefined ? playback.stageLineSpacing : 24;
    var stagePositionY = playback.stagePositionY !== undefined ? playback.stagePositionY : 0;
    var stageFontSize = playback.stageFontSize !== undefined ? playback.stageFontSize : 64;
    var commentPercent = playback.stageCommentWidthPercent !== undefined ? playback.stageCommentWidthPercent : 20;

    var songId = song ? song.id : null;
    if (songId !== stageLastSongId || stageFontSize !== stageLastFontSize || stageLineSpacing !== stageLastSpacing) {
      stageMeasuredHeights = {};
      stageLastSongId = songId;
      stageLastFontSize = stageFontSize;
      stageLastSpacing = stageLineSpacing;
    }

    var stageShowTitle = !!playback.stageShowTitle;
    // idx = line currently sung (white); currentIdx = line the view is centered on.
    // Before the first line the view shows line 0 in grey (see useStageLineState in src/hooks/usePlaybackPosition.js).
    var idx = song ? currentIndex(lines, elapsed + stageLeadSeconds) : -1;
    var currentIdx = idx >= 0 ? idx : Math.max(0, song ? startedIndex(lines, elapsed + stageLeadSeconds) : 0);

    var lineRowHeight = Math.max(20, Math.round(stageFontSize * 1.2 + stageLineSpacing));
    var titleBarHeight = stageShowTitle ? Math.round(stageFontSize * 0.5 * 1.2 + 24) : 0;

    // Calculate active center offset using measured line heights to prevent downward drift from wrapped lines
    var activeCenterOffset = 0;
    for (var k = 0; k < currentIdx; k++) {
      activeCenterOffset += (stageMeasuredHeights[k] || lineRowHeight);
    }
    activeCenterOffset += ((stageMeasuredHeights[currentIdx] || lineRowHeight) / 2);

    var linesHtml = '';
    if (lines.length === 0) {
      linesHtml = '<div style="color: ' + COLORS.stageTextDim + '; font-family: Gelasio, Georgia, serif; font-size: ' + (stageFontSize * 0.75) + 'px; text-align: center; opacity: 0.4;">— Kein Song geladen —</div>';
    } else {
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        var isCurrent = (i === currentIdx && idx >= 0);
        var isPast = (i < currentIdx);
        var isVisible = (i >= currentIdx - stagePastLines && i <= currentIdx + stageFutureLines);
        var opacity = !isVisible ? '0' : (isCurrent ? '1' : (isPast ? '0.25' : '0.4'));
        var pointerEvents = !isVisible ? 'none' : 'auto';

        if (commentPercent === 0) {
          linesHtml += [
            '<div id="legacy-stage-line-' + i + '" style="min-height: ' + lineRowHeight + 'px; width: 100%; display: -webkit-box; display: -webkit-flex; display: flex; -webkit-box-align: center; -webkit-align-items: center; align-items: center; padding: 8px 0; opacity: ' + opacity + '; pointer-events: ' + pointerEvents + '; -webkit-transition: opacity 0.5s ease-out; transition: opacity 0.5s ease-out; box-sizing: border-box;">',
            '  <div style="color: ' + (isCurrent ? COLORS.stageText : COLORS.stageTextDim) + '; font-family: Gelasio, Georgia, serif; font-size: ' + stageFontSize + 'px; line-height: 1.2; text-align: left; font-weight: bold; width: 100%; word-break: break-word;">',
            escapeHtml(l.en),
            '  </div>',
            '</div>'
          ].join('\n');
        } else {
          var commentColor = isCurrent ? COLORS.amber : COLORS.stageTextDim;
          var commentWeight = isCurrent ? 'bold' : '500';
          var textColor = isCurrent ? COLORS.stageText : COLORS.stageTextDim;

          linesHtml += [
            '<div id="legacy-stage-line-' + i + '" style="min-height: ' + lineRowHeight + 'px; width: 100%; display: -webkit-box; display: -webkit-flex; display: flex; -webkit-box-align: center; -webkit-align-items: center; align-items: center; padding: 8px 0; opacity: ' + opacity + '; pointer-events: ' + pointerEvents + '; -webkit-transition: opacity 0.5s ease-out; transition: opacity 0.5s ease-out; box-sizing: border-box;">',
            '  <div style="width: ' + commentPercent + '%; text-align: right; font-family: ui-sans-serif, system-ui, sans-serif; font-size: ' + (stageFontSize * 0.5) + 'px; line-height: 1.2; color: ' + commentColor + '; font-weight: ' + commentWeight + '; padding-right: 20px; box-sizing: border-box; word-break: break-word; -webkit-flex-shrink: 0; flex-shrink: 0;">',
            escapeHtml(l.comment || ''),
            '  </div>',
            '  <div style="width: ' + (100 - commentPercent) + '%; text-align: left; font-family: Gelasio, Georgia, serif; font-size: ' + stageFontSize + 'px; line-height: 1.2; color: ' + textColor + '; font-weight: bold; padding-left: 20px; box-sizing: border-box; word-break: break-word;">',
            escapeHtml(l.en),
            '  </div>',
            '</div>'
          ].join('\n');
        }
      }
    }

    var verticalDivider = '';
    if (commentPercent > 0 && commentPercent < 100) {
      verticalDivider = '<div style="position: absolute; top: 0; bottom: 0; width: 1px; background: #27272a; left: ' + commentPercent + '%; z-index: 10; pointer-events: none; opacity: 0.6;"></div>';
    }

    var transformY = 'translateY(-' + activeCenterOffset + 'px)';
    var topPos = (50 + stagePositionY) + '%';

    var titleHtml = '';
    if (stageShowTitle) {
      var titlePadding = (commentPercent > 0 && commentPercent < 100) ? 'padding-left: ' + commentPercent + '%;' : '';
      titleHtml = '  <div style="position: absolute; top: 0; left: 24px; right: 24px; height: ' + titleBarHeight + 'px; box-sizing: border-box; border-bottom: 1px solid #27272a; color: ' + COLORS.stageTextDim + '; font-family: Gelasio, Georgia, serif; font-size: ' + (stageFontSize * 0.5) + 'px; line-height: ' + titleBarHeight + 'px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ' + titlePadding + '">' +
        '<span style="padding-left: 20px;">' + escapeHtml(song ? song.title : '') + '</span></div>';
    }

    var html = [
      renderConnectionBadge(),
      '<div id="stage-container" class="legacy-cursor-none" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: ' + COLORS.stageBg + '; overflow: hidden; -webkit-user-select: none; user-select: none;">',
      titleHtml,
      '  <div style="position: absolute; top: ' + titleBarHeight + 'px; left: 0; right: 0; bottom: 0; overflow: hidden; padding: 0 24px; box-sizing: border-box;">',
      verticalDivider,
      '    <div id="stage-scroller" style="width: 100%; position: absolute; left: 0; top: ' + topPos + '; -webkit-transform: ' + transformY + '; transform: ' + transformY + '; -webkit-transition: -webkit-transform 0.5s ease-out; transition: transform 0.5s ease-out;">',
      linesHtml,
      '    </div>',
      '  </div>',
      renderHeartbeat(song, playback, false, false),
      '  <button id="legacy-fs-btn" style="position: fixed; top: 16px; left: 16px; background: transparent; border: 1px solid #71717a; color: #71717a; border-radius: 4px; padding: 6px 10px; font-size: 12px; cursor: pointer; opacity: 0.2; z-index: 100;">Vollbild</button>',
      '</div>'
    ].join('\n');

    if (!setRootHtml(html)) return;

    // Cache rendered line element heights and adjust scroller transform from real DOM measurements
    if (lines.length > 0) {
      for (var m = 0; m < lines.length; m++) {
        var lineEl = document.getElementById('legacy-stage-line-' + m);
        if (lineEl && lineEl.offsetHeight > 0) {
          stageMeasuredHeights[m] = lineEl.offsetHeight;
        }
      }
      var activeEl = document.getElementById('legacy-stage-line-' + currentIdx);
      if (activeEl) {
        var realCenter = activeEl.offsetTop + activeEl.offsetHeight / 2;
        var scrollerEl = document.getElementById('stage-scroller');
        if (scrollerEl && Math.abs(realCenter - activeCenterOffset) > 1) {
          var realTransform = 'translateY(-' + realCenter + 'px)';
          scrollerEl.style.webkitTransform = realTransform;
          scrollerEl.style.transform = realTransform;
        }
      }
    }

    var fsBtn = document.getElementById('legacy-fs-btn');
    if (fsBtn) {
      fsBtn.onclick = function() {
        requestFullscreen(document.documentElement); // not the container: it is replaced when the view changes
      };
    }
  }

  function renderProjectionView(song, playback, elapsed) {
    var lines = song ? sortedLines(song) : [];
    var duration = getSongDuration(lines);
    var isSongCompleted = song ? (elapsed >= duration) : false;
    var showText = !isBlackout && playback.status === 'playing' && song && !isSongCompleted;

    var idx = showText ? currentIndex(lines, elapsed) : -1;
    var activeLine = idx >= 0 ? lines[idx] : null;
    var line = (activeLine && !activeLine.stageOnly) ? activeLine : null;

    var fontSize = playback.fontSize !== undefined ? playback.fontSize : 64;
    var translationPercent = playback.translationPercent !== undefined ? playback.translationPercent : 60;
    var translationSpacing = playback.translationSpacing !== undefined ? playback.translationSpacing : 24;
    var positionX = playback.positionX !== undefined ? playback.positionX : 50;
    var positionY = playback.positionY !== undefined ? playback.positionY : 50;
    var liveWidthPercent = playback.liveWidthPercent !== undefined ? playback.liveWidthPercent : 100;
    var liveTextAlign = playback.liveTextAlign || 'center';

    var textAlignCss = liveTextAlign === 'left' ? 'left' : (liveTextAlign === 'right' ? 'right' : 'center');

    var contentHtml = '';
    if (line) {
      var deHtml = '';
      if (line.de) {
        var deSize = (fontSize * translationPercent / 100);
        deHtml = '<div style="color: ' + COLORS.stageTextDim + '; font-family: ui-sans-serif, system-ui, sans-serif; font-size: ' + deSize + 'px; font-weight: normal; line-height: 1.3; width: 100%; margin-top: ' + translationSpacing + 'px; word-break: break-word;">' + escapeHtml(line.de) + '</div>';
      }

      contentHtml = [
        '<div style="position: absolute; left: ' + positionX + '%; top: ' + positionY + '%; -webkit-transform: translate(-50%, -50%); transform: translate(-50%, -50%); width: ' + liveWidthPercent + '%; text-align: ' + textAlignCss + '; pointer-events: none; box-sizing: border-box;">',
        '  <div style="color: ' + COLORS.stageText + '; font-family: Gelasio, Georgia, serif; font-size: ' + fontSize + 'px; font-weight: bold; line-height: 1.2; width: 100%; word-break: break-word;">' + escapeHtml(line.en) + '</div>',
        deHtml,
        '</div>'
      ].join('\n');
    }

    var html = [
      renderConnectionBadge(),
      '<div id="projection-container" class="legacy-cursor-none" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: ' + COLORS.stageBg + '; overflow: hidden; -webkit-user-select: none; user-select: none;">',
      contentHtml,
      renderHeartbeat(song, playback, isSongCompleted, isBlackout),
      '  <button id="legacy-fs-btn" style="position: fixed; top: 16px; left: 16px; background: transparent; border: 1px solid #71717a; color: #71717a; border-radius: 4px; padding: 6px 10px; font-size: 12px; cursor: pointer; opacity: 0.1; z-index: 100;">Vollbild</button>',
      '</div>'
    ].join('\n');

    if (!setRootHtml(html)) return;

    var fsBtn = document.getElementById('legacy-fs-btn');
    if (fsBtn) {
      fsBtn.onclick = function() {
        requestFullscreen(document.documentElement); // not the container: it is replaced when the view changes
      };
    }
  }

  function renderLegacyControlInfo() {
    var html = [
      renderConnectionBadge(),
      '<div style="min-height: 100vh; background: #09090b; display: -webkit-box; display: -webkit-flex; display: flex; -webkit-box-orient: vertical; -webkit-box-direction: normal; -webkit-flex-direction: column; flex-direction: column; -webkit-box-align: center; -webkit-align-items: center; align-items: center; -webkit-box-pack: center; -webkit-justify-content: center; justify-content: center; padding: 24px; text-align: center; box-sizing: border-box;">',
      '  <div style="max-width: 520px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px 24px; box-sizing: border-box; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">',
      '    <div style="font-size: 36px; margin-bottom: 12px;">💡</div>',
      '    <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: bold; color: #ffffff;">Autolyrics Legacy-Modus</h2>',
      '    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #a1a1aa;">Auf diesem älteren Browser läuft der optimierte Legacy-Modus. Dieser eignet sich ideal als Anzeige-Player für Tablets und Monitore.</p>',
      '    <div style="display: -webkit-box; display: -webkit-flex; display: flex; -webkit-box-orient: vertical; -webkit-box-direction: normal; -webkit-flex-direction: column; flex-direction: column; gap: 10px; margin-top: 16px;">',
      '      <a href="/player" style="display: block; padding: 12px; background: #27272a; border-radius: 8px; color: #ffffff; text-decoration: none; font-weight: bold; margin-bottom: 8px;">📱 Player-Ansicht öffnen (/player)</a>',
      '      <a href="/stage" style="display: block; padding: 12px; background: #27272a; border-radius: 8px; color: #ffffff; text-decoration: none; font-weight: bold; margin-bottom: 8px;">🎤 Bühnen-Monitor öffnen (/stage)</a>',
      '      <a href="/live" style="display: block; padding: 12px; background: #27272a; border-radius: 8px; color: #ffffff; text-decoration: none; font-weight: bold;">📽 Live-Projektion öffnen (/live)</a>',
      '    </div>',
      '    <p style="margin-top: 24px; font-size: 12px; color: #71717a;">Hinweis: Die vollständige Steuerung und der Song-Editor erfordern einen modernen Browser.</p>',
      renderVersionInfo(),
      '  </div>',
      '</div>'
    ].join('\n');
    if (!setRootHtml(html)) return;
  }

  function sortedLines(song) {
    return computeLinesWithTimes(song);
  }

  // Stage settings of this device (players[id].stageSettings) override the global ones
  var PLAYER_STAGE_SETTING_KEYS = ['stageFontSize', 'stageCommentWidthPercent', 'stagePositionY'];

  function getStagePlayback() {
    var player = state.players && state.players[state.playerId];
    var overrides = player && player.stageSettings;
    if (!overrides) return state.playback;
    var merged = {};
    for (var k in state.playback) {
      if (Object.prototype.hasOwnProperty.call(state.playback, k)) merged[k] = state.playback[k];
    }
    for (var i = 0; i < PLAYER_STAGE_SETTING_KEYS.length; i++) {
      var key = PLAYER_STAGE_SETTING_KEYS[i];
      if (overrides[key] !== undefined && overrides[key] !== null) merged[key] = overrides[key];
    }
    return merged;
  }

  function render() {
    var view = getCurrentView();
    var song = null;
    if (state.songs && state.songs.length) {
      for (var i = 0; i < state.songs.length; i++) {
        if (state.songs[i].id === state.playback.songId) {
          song = state.songs[i];
          break;
        }
      }
    }
    var elapsed = computeElapsed(state.playback);

    if (view === 'player') {
      var localPlayer = state.players[state.playerId];
      if (localPlayer && localPlayer.role === 'live') {
        renderProjectionView(song, state.playback, elapsed);
      } else if (localPlayer && localPlayer.role === 'stage') {
        renderStageView(song, getStagePlayback(), elapsed);
      } else {
        renderPlayerUnassigned();
      }
    } else if (view === 'projection') {
      renderProjectionView(song, state.playback, elapsed);
    } else if (view === 'stage') {
      renderStageView(song, getStagePlayback(), elapsed);
    } else {
      renderLegacyControlInfo();
    }
  }

  // Update loop: while playing, check 10x per second whether the view changed
  // (render() only touches the DOM when its HTML differs)
  function tick() {
    if (state.playback && state.playback.status === 'playing') {
      render();
    }
  }

  // Handle URL history popstate
  window.addEventListener('popstate', function() {
    render();
  });

  // Handle window resize / iPad orientation change
  window.addEventListener('resize', function() {
    stageMeasuredHeights = {};
    lastRootHtml = null; // force re-render and re-measuring of line heights
    render();
  });

  // Start WebSocket and Loop
  connectWebSocket();
  render();
  setInterval(tick, 100);

})();
