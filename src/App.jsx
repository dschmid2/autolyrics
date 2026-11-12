import { useMemo } from 'react';
import { ThemeContext, useThemeState } from './theme';
import { ConnectionBadge } from './components/ConnectionBadge';
import { GlobalStyles } from './components/GlobalStyles';
import { TopMenuBar } from './components/TopMenuBar';
import { useSyncedState } from './hooks/useSyncedState';
import { useViewRoute } from './hooks/useViewRoute';
import { applyPlayerStageSettings } from './lib/playback';
import { ControlView } from './views/ControlView';
import { OptionsView } from './views/OptionsView';
import { PlayersView } from './views/PlayersView';
import { ProjectionView } from './views/ProjectionView';
import { StageView } from './views/StageView';
import { UnassignedPlayerView } from './views/UnassignedPlayerView';
import { EditorView } from './views/editor/EditorView';

export default function App() {
  const themeState = useThemeState();
  const { view, navigate, setSubView } = useViewRoute();
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

  const localPlayer = players[playerId] || null;
  // Stage settings of this device (player) override the global ones
  const localStageSettingsKey = JSON.stringify((localPlayer && localPlayer.stageSettings) || null);
  const stagePlayback = useMemo(
    () => applyPlayerStageSettings(playback, JSON.parse(localStageSettingsKey)),
    [playback, localStageSettingsKey]
  );

  const exitToControl = () => navigate('control');
  const projection = <ProjectionView songs={songs} playback={playback} onExit={exitToControl} connected={connected} />;
  const stage = <StageView songs={songs} playback={stagePlayback} onExit={exitToControl} />;

  // Display devices: /player shows the view of the role the operator assigned
  let display = null;
  if (view === 'player') {
    const role = localPlayer && localPlayer.role;
    display = role === 'live' ? projection
      : role === 'stage' ? stage
      : <UnassignedPlayerView playerId={playerId} playerName={localPlayer && localPlayer.name} serverVersion={serverVersion} />;
  } else if (view === 'projection') {
    display = projection;
  } else if (view === 'stage') {
    display = stage;
  }

  return (
    <ThemeContext.Provider value={themeState}>
      <ConnectionBadge connected={connected} />
      <GlobalStyles />
      {display || (
        <div className="min-h-screen" style={{ background: themeState.colors.panelBg }}>
          <TopMenuBar
            activeView={view}
            onNavigate={setSubView}
            onGotoProjection={() => navigate('projection')}
            onGotoStage={() => navigate('stage')}
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
            <ControlView songs={songs} playback={playback} sendPlayback={sendPlayback} />
          )}
        </div>
      )}
    </ThemeContext.Provider>
  );
}
