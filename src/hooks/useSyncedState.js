import { useState, useEffect, useRef, useCallback } from 'react';
import { recordClockSample, resetClockSync, setInitialClockOffset } from '../lib/clock';
import { getOrCreatePlayerId } from '../lib/ids';
import { defaultPlayback } from '../lib/playback';

export function useSyncedState() {
  const [songs, setSongs] = useState([]);
  const [playback, setPlayback] = useState(defaultPlayback());
  const [players, setPlayers] = useState({});
  const [connected, setConnected] = useState(false);
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('');
  const [serverVersion, setServerVersion] = useState('');
  const playerIdRef = useRef(getOrCreatePlayerId());
  const wsRef = useRef(null);
  const lastMessageTimeRef = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    let heartbeatTimer = null;

    function connect() {
      clearTimeout(retryTimer);
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) {
          lastMessageTimeRef.current = Date.now();
          setConnected(true);
          ws.send(JSON.stringify({ type: 'registerPlayer', playerId: playerIdRef.current }));
          // Quick burst of clock sync pings right after connecting
          resetClockSync();
          [0, 250, 500, 1000, 2000].forEach((delay) => {
            setTimeout(() => {
              if (!cancelled && ws.readyState === 1) {
                try { ws.send(JSON.stringify({ type: 'ping', t0: Date.now() })); } catch (e) {}
              }
            }, delay);
          });
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        lastMessageTimeRef.current = Date.now();
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'ping') {
            try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) {}
            return;
          }
          if (msg.type === 'pong') {
            if (msg.t0 !== undefined && msg.serverNow !== undefined) recordClockSample(msg.t0, msg.serverNow);
            return;
          }

          if (msg.type === 'state') {
            // Rough first estimate until the first ping/pong round trip arrives
            if (msg.serverNow) setInitialClockOffset(msg.serverNow);
            setSongs(msg.songs);
            setPlayback(msg.playback);
            if (msg.players) setPlayers(msg.players);
            if (msg.serverIp) setServerIp(msg.serverIp);
            if (msg.serverPort) setServerPort(msg.serverPort);
            if (msg.serverVersion) setServerVersion(msg.serverVersion);
          }
          if (msg.type === 'songs') setSongs(msg.songs);
          if (msg.type === 'playback') setPlayback(msg.playback);
          if (msg.type === 'players') setPlayers(msg.players);
        } catch (e) {}
      };
    }
    connect();

    // Heartbeat keepalive and watchdog
    heartbeatTimer = setInterval(() => {
      if (cancelled) return;
      if (wsRef.current && wsRef.current.readyState === 1) {
        try { wsRef.current.send(JSON.stringify({ type: 'ping', t0: Date.now() })); } catch (e) {}
        if (Date.now() - lastMessageTimeRef.current > 35000) {
          try { wsRef.current.close(); } catch (e) {}
        }
      }
    }, 10000);

    const checkAndReconnect = () => {
      if (cancelled) return;
      const isConnecting = wsRef.current && wsRef.current.readyState === 0;
      const isOpen = wsRef.current && wsRef.current.readyState === 1;
      const isTimedOut = isOpen && (Date.now() - lastMessageTimeRef.current > 25000);

      if (!isConnecting && (!isOpen || isTimedOut)) {
        if (wsRef.current) {
          try { wsRef.current.close(); } catch (e) {}
        }
        clearTimeout(retryTimer);
        connect();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkAndReconnect();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', checkAndReconnect);
    window.addEventListener('focus', checkAndReconnect);
    window.addEventListener('online', checkAndReconnect);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', checkAndReconnect);
      window.removeEventListener('focus', checkAndReconnect);
      window.removeEventListener('online', checkAndReconnect);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendSongs = useCallback((next) => {
    setSongs(next);
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'setSongs', songs: next }));
    }
  }, []);

  const sendPlayback = useCallback((next) => {
    const withTs = { ...next, updatedAt: Date.now() };
    setPlayback(withTs);
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'setPlayback', playback: withTs }));
    }
  }, []);

  const sendPlayerRole = useCallback((targetPlayerId, role) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'setPlayerRole', playerId: targetPlayerId, role }));
    }
  }, []);

  const sendPlayerName = useCallback((targetPlayerId, name) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'setPlayerName', playerId: targetPlayerId, name }));
    }
  }, []);

  const sendPlayerStageSettings = useCallback((targetPlayerId, stageSettings) => {
    // Optimistic local update, the server broadcasts the sanitized result
    setPlayers((prev) => {
      if (!prev[targetPlayerId]) return prev;
      const next = { ...prev[targetPlayerId] };
      if (stageSettings && Object.keys(stageSettings).length) next.stageSettings = stageSettings;
      else delete next.stageSettings;
      return { ...prev, [targetPlayerId]: next };
    });
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'setPlayerStageSettings', playerId: targetPlayerId, stageSettings: stageSettings || {} }));
    }
  }, []);

  const sendDeletePlayer = useCallback((targetPlayerId) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'deletePlayer', playerId: targetPlayerId }));
    }
  }, []);

  return {
    songs,
    playback,
    players,
    connected,
    playerId: playerIdRef.current,
    sendSongs,
    sendPlayback,
    sendPlayerRole,
    sendPlayerName,
    sendPlayerStageSettings,
    sendDeletePlayer,
    serverIp,
    serverPort,
    serverVersion,
  };
}
