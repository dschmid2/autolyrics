import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useTheme } from '../theme';
import { PLAYER_STAGE_SETTINGS } from '../lib/playback';

export function PlayerStageSettings({ player, playback, onChange }) {
  const { colors: COLORS, isDark } = useTheme();
  const overrides = player.stageSettings || {};
  const overrideCount = PLAYER_STAGE_SETTINGS.filter(({ key }) => overrides[key] !== undefined).length;
  const [open, setOpen] = useState(overrideCount > 0);

  const setValue = (key, value) => onChange({ ...overrides, [key]: value });
  const resetValue = (key) => {
    const next = { ...overrides };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="border-t pt-2" style={{ borderColor: COLORS.line }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-xs font-medium py-1"
        style={{ color: COLORS.inkDim }}
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Stage-Einstellungen
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${overrideCount ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold' : ''}`}
          style={overrideCount ? undefined : { color: COLORS.inkDim }}
        >
          {overrideCount ? `${overrideCount} angepasst` : 'Standard'}
        </span>
      </button>

      {open && (
        <div className="space-y-3 pt-2">
          {PLAYER_STAGE_SETTINGS.map((field) => {
            const globalValue = playback[field.key] !== undefined ? playback[field.key] : field.fallback;
            const isOverridden = overrides[field.key] !== undefined;
            const value = isOverridden ? overrides[field.key] : globalValue;
            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2" style={{ color: COLORS.inkDim }}>
                  <span>{field.label}</span>
                  <span className="flex items-center gap-2">
                    {isOverridden ? (
                      <>
                        <span className="font-mono font-semibold" style={{ color: COLORS.ink }}>{field.format(value)}</span>
                        <button
                          type="button"
                          onClick={() => resetValue(field.key)}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'}`}
                          title={`Zurück auf Grundeinstellung (${field.format(globalValue)})`}
                        >
                          Standard
                        </button>
                      </>
                    ) : (
                      <span className="font-mono">{field.format(globalValue)} (Standard)</span>
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={value}
                  onChange={(e) => setValue(field.key, Number(e.target.value))}
                  className={`w-full accent-amber ${isOverridden ? '' : 'opacity-50'}`}
                />
              </div>
            );
          })}
          {overrideCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="text-[11px] underline"
              style={{ color: COLORS.inkDim }}
            >
              Alle auf Grundeinstellung zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PlayerNameInput({ player, onSave }) {
  const { colors: COLORS } = useTheme();
  const [value, setValue] = useState(player.name || '');
  const [focused, setFocused] = useState(false);
  // Follow updates from other operators while not editing
  useEffect(() => {
    if (!focused) setValue(player.name || '');
  }, [player.name, focused]);

  const commit = () => {
    const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, 40);
    setValue(trimmed);
    if (trimmed !== (player.name || '')) onSave(trimmed);
  };

  return (
    <input
      type="text"
      value={value}
      maxLength={40}
      placeholder="Gerätename (z. B. iPad links)"
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setValue(player.name || ''); setTimeout(() => e.target.blur(), 0); }
      }}
      className="w-full min-w-0 text-sm font-semibold bg-transparent border-b border-transparent hover:border-current focus:border-amber-500 outline-none py-0.5 placeholder:font-normal placeholder:italic placeholder:opacity-50"
      style={{ color: COLORS.ink }}
    />
  );
}

export function PlayersView({ players = {}, playback = {}, localPlayerId, onSetPlayerRole, onSetPlayerName, onSetPlayerStageSettings, onDeletePlayer }) {
  const { colors: COLORS, isDark } = useTheme();
  const playerList = Object.values(players);

  return (
    <div className="min-h-screen pb-10" style={{ background: COLORS.panelBg }}>
      <div className="max-w-[1200px] w-full mx-auto p-4 md:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Player-Verwaltung</h1>
            <p className="text-xs" style={{ color: COLORS.inkDim }}>
              Verbundene Geräte verwalten und Rollen (Projektion / Stageview) zuweisen.
            </p>
          </div>
        </div>

        <div className="rounded-xl p-5 space-y-4 shadow-sm" style={{ background: COLORS.panelBg2 }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: COLORS.line }}>
            <span className="font-semibold text-sm" style={{ color: COLORS.ink }}>
              Verbundene Player ({playerList.length})
            </span>
          </div>

          {playerList.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="text-sm font-medium" style={{ color: COLORS.ink }}>
                Aktuell sind keine Player verbunden.
              </div>
              <div className="text-xs max-w-md mx-auto" style={{ color: COLORS.inkDim }}>
                Öffne auf einem anderen Gerät die URL <code className="font-mono px-1 py-0.5 rounded font-semibold" style={{ background: COLORS.line, color: COLORS.ink }}>/player</code>, um das Gerät automatisch hier registrieren zu lassen.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {playerList.map((p) => {
                const isSelf = p.id === localPlayerId;
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-lg shadow-sm space-y-3 border"
                    style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.online ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-zinc-400'}`}
                          title={p.online ? 'Online' : 'Offline'}
                        />
                        <PlayerNameInput player={p} onSave={(name) => onSetPlayerName(p.id, name)} />
                        {isSelf && (
                          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            Dieses Gerät
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onDeletePlayer(p.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-500 transition-colors"
                        title="Player entfernen"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="font-mono text-[10px] -mt-2 pl-[18px] truncate" style={{ color: COLORS.inkDim }} title={p.id}>
                      {p.id}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium" style={{ color: COLORS.inkDim }}>
                        Zugewiesene Rolle:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onSetPlayerRole(p.id, 'live')}
                          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                            p.role === 'live'
                              ? 'bg-amber-500 text-black font-bold shadow-sm'
                              : isDark
                              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                        >
                          Live
                        </button>
                        <button
                          onClick={() => onSetPlayerRole(p.id, 'stage')}
                          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                            p.role === 'stage'
                              ? 'bg-amber-500 text-black font-bold shadow-sm'
                              : isDark
                              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                          }`}
                        >
                          Stage
                        </button>
                        <button
                          onClick={() => onSetPlayerRole(p.id, null)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                            !p.role
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold'
                              : isDark
                              ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          Keine
                        </button>
                      </div>
                    </div>

                    <PlayerStageSettings
                      player={p}
                      playback={playback}
                      onChange={(stageSettings) => onSetPlayerStageSettings(p.id, stageSettings)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
