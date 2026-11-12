import { useState, useEffect, useCallback, useMemo } from 'react';
import { THEME_PALETTES, ThemeContext } from './theme';
import { ConnectionBadge } from './components/ConnectionBadge';
import { TopMenuBar } from './components/TopMenuBar';
import { useElapsed } from './hooks/usePlaybackPosition';
import { useSyncedState } from './hooks/useSyncedState';
import { serverNow } from './lib/clock';
import { computeElapsed, applyPlayerStageSettings } from './lib/playback';
import { ControlView } from './views/ControlView';
import { OptionsView } from './views/OptionsView';
import { PlayersView } from './views/PlayersView';
import { ProjectionView } from './views/ProjectionView';
import { StageView } from './views/StageView';
import { UnassignedPlayerView } from './views/UnassignedPlayerView';
import { EditorView } from './views/editor/EditorView';

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('autolyrics_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (e) {}
    return 'light';
  });

  const isDark = theme === 'dark';
  const colors = THEME_PALETTES[theme] || THEME_PALETTES.light;
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('autolyrics_theme', theme);
    } catch (e) {}
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [view, setView] = useState(() => {
    const path = window.location.pathname;
    if (path === '/live') return 'projection';
    if (path === '/stage') return 'stage';
    if (path === '/player') return 'player';
    return 'control';
  });

  const {
    songs,
    playback,
    players,
    connected,
    playerId,
    sendSongs,
    sendPlayback,
    sendPlayerRole,
    sendPlayerName,
    sendPlayerStageSettings,
    sendDeletePlayer,
    serverVersion
  } = useSyncedState();
  const elapsed = useElapsed(playback);

  const localPlayer = players[playerId] || null;
  // Stage settings of this device (player) override the global ones
  const localStageSettingsKey = JSON.stringify((localPlayer && localPlayer.stageSettings) || null);
  const stagePlayback = useMemo(
    () => applyPlayerStageSettings(playback, JSON.parse(localStageSettingsKey)),
    [playback, localStageSettingsKey]
  );

  // Sync state view changes with the browser URL (via history pushState)
  const changeView = (nextView) => {
    setView(nextView);
    if (nextView === 'projection') {
      window.history.pushState(null, '', '/live');
    } else if (nextView === 'stage') {
      window.history.pushState(null, '', '/stage');
    } else if (nextView === 'player') {
      window.history.pushState(null, '', '/player');
    } else if (nextView === 'control') {
      window.history.pushState(null, '', '/');
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/live') setView('projection');
      else if (path === '/stage') setView('stage');
      else if (path === '/player') setView('player');
      else setView('control');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadSong = (song) => sendPlayback({ ...playback, songId: song.id, status: 'stopped', anchorEpoch: serverNow(), anchorElapsed: 0 });
  const togglePlay = () => {
    if (playback.status === 'playing') {
      sendPlayback({ ...playback, status: 'paused', anchorElapsed: computeElapsed(playback), anchorEpoch: serverNow() });
    } else {
      sendPlayback({ ...playback, status: 'playing', anchorEpoch: serverNow() });
    }
  };
  const stopSong = () => sendPlayback({ ...playback, status: 'stopped', anchorElapsed: 0, anchorEpoch: serverNow() });
  const seekTo = (sec) => sendPlayback({ ...playback, anchorElapsed: Math.max(0, sec), anchorEpoch: serverNow() });
  const nudge = (delta) => seekTo(computeElapsed(playback) + delta);
  const playFromLine = (sec) => {
    sendPlayback({
      ...playback,
      status: 'playing',
      anchorElapsed: Math.max(0, sec),
      anchorEpoch: serverNow(),
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme, colors }}>
      <ConnectionBadge connected={connected} />
      <style>{`
        .choir-beat-dot { animation-name: choirBeatPulse; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes choirBeatPulse { 0% { transform: scale(1); opacity: .15; } 15% { transform: scale(1.8); opacity: .55; } 100% { transform: scale(1); opacity: .15; } }
        @media (prefers-reduced-motion: reduce) { .choir-beat-dot { animation: none; opacity: .3; } }
        button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid ${colors.amber}; outline-offset: 2px; }
      `}</style>
      {view === 'player' ? (
        localPlayer && localPlayer.role === 'live' ? (
          <ProjectionView songs={songs} playback={playback} onExit={() => changeView('control')} connected={connected} />
        ) : localPlayer && localPlayer.role === 'stage' ? (
          <StageView songs={songs} playback={stagePlayback} onExit={() => changeView('control')} />
        ) : (
          <UnassignedPlayerView playerId={playerId} playerName={localPlayer && localPlayer.name} serverVersion={serverVersion} />
        )
      ) : view === 'projection' ? (
        <ProjectionView songs={songs} playback={playback} onExit={() => changeView('control')} connected={connected} />
      ) : view === 'stage' ? (
        <StageView songs={songs} playback={stagePlayback} onExit={() => changeView('control')} />
      ) : (
        <div className="min-h-screen" style={{ background: colors.panelBg }}>
          <TopMenuBar
            activeView={view}
            onNavigate={(next) => setView(next)}
            onGotoProjection={() => changeView('projection')}
            onGotoStage={() => changeView('stage')}
            playersCount={Object.keys(players).length}
            serverVersion={serverVersion}
          />
          {view === 'editor' ? (
            <EditorView
              songs={songs}
              onChangeSongs={sendSongs}
              playback={playback}
              sendPlayback={sendPlayback}
            />
          ) : view === 'options' ? (
            <OptionsView playback={playback} onChangePlayback={(patch) => sendPlayback({ ...playback, ...patch })} />
          ) : view === 'players' ? (
            <PlayersView
              players={players}
              playback={playback}
              localPlayerId={playerId}
              onSetPlayerRole={sendPlayerRole}
              onSetPlayerName={sendPlayerName}
              onSetPlayerStageSettings={sendPlayerStageSettings}
              onDeletePlayer={sendDeletePlayer}
            />
          ) : (
            <ControlView
              songs={songs}
              playback={playback}
              elapsed={elapsed}
              onLoad={loadSong}
              onTogglePlay={togglePlay}
              onStop={stopSong}
              onSeek={playFromLine}
              onPlayFromLine={playFromLine}
              onNudge={nudge}
            />
          )}
        </div>
      )}
    </ThemeContext.Provider>
  );
}
