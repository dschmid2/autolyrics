import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme';

export function OptionsView({ playback, onChangePlayback }) {
  const { colors: COLORS, theme, setTheme } = useTheme();
  const fontSize = playback.fontSize !== undefined ? playback.fontSize : 64;
  const translationPercent = playback.translationPercent !== undefined ? playback.translationPercent : 60;
  const translationSpacing = playback.translationSpacing !== undefined ? playback.translationSpacing : 24;
  const positionX = playback.positionX !== undefined ? playback.positionX : 50;
  const positionY = playback.positionY !== undefined ? playback.positionY : 50;
  const liveWidthPercent = playback.liveWidthPercent !== undefined ? playback.liveWidthPercent : 100;
  const liveTextAlign = playback.liveTextAlign || 'center';
  const showHeartbeat = playback.showHeartbeat !== undefined ? playback.showHeartbeat : true;
  const stagePastLines = playback.stagePastLines !== undefined ? playback.stagePastLines : 2;
  const stageFutureLines = playback.stageFutureLines !== undefined ? playback.stageFutureLines : 2;
  const stageLeadSeconds = playback.stageLeadSeconds !== undefined ? playback.stageLeadSeconds : 0;
  const stagePositionY = playback.stagePositionY !== undefined ? playback.stagePositionY : 0;

  return (
    <div className="min-h-screen pb-10" style={{ background: COLORS.panelBg }}>
      <div className="max-w-[1200px] w-full mx-auto p-4 md:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Anzeige-Optionen</h1>
            <p className="text-xs" style={{ color: COLORS.inkDim }}>
              Einstellungen für Projektion (Live-View), Bühnenanzeige (Stageview) und Darstellung.
            </p>
          </div>
          <div className="flex items-center gap-1.5 p-1 rounded-xl border self-start sm:self-auto" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'light'
                  ? 'bg-amber text-zinc-950 font-bold shadow-sm'
                  : 'hover:opacity-100 opacity-80'
              }`}
              style={{
                background: theme === 'light' ? COLORS.amber : 'transparent',
                color: theme === 'light' ? '#241a08' : COLORS.ink,
              }}
            >
              <Sun size={14} />
              <span>Hell</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                theme === 'dark'
                  ? 'bg-amber text-zinc-950 font-bold shadow-sm'
                  : 'hover:opacity-100 opacity-80'
              }`}
              style={{
                background: theme === 'dark' ? COLORS.amber : 'transparent',
                color: theme === 'dark' ? '#241a08' : COLORS.ink,
              }}
            >
              <Moon size={14} />
              <span>Dunkel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Card 1: Live-View (Projektion) */}
          <div className="rounded-2xl p-5 space-y-4 shadow-sm" style={{ background: COLORS.panelBg2 }}>
            <div className="border-b pb-2 flex items-center justify-between" style={{ borderColor: COLORS.line }}>
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: COLORS.ink }}>
                Projektion (Live-View)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-black/5" style={{ color: COLORS.inkDim }}>
                /live
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Schriftgrösse Projektion</span>
                <span className="font-mono">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                value={fontSize}
                onChange={(e) => onChangePlayback({ fontSize: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Grösse Übersetzung</span>
                <span className="font-mono">{translationPercent}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                value={translationPercent}
                onChange={(e) => onChangePlayback({ translationPercent: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Abstand zwischen Text und Übersetzung</span>
                <span className="font-mono">{translationSpacing}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={translationSpacing}
                onChange={(e) => onChangePlayback({ translationSpacing: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                  <span>Position X (Zentrum)</span>
                  <span className="font-mono">{positionX}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={positionX}
                  onChange={(e) => onChangePlayback({ positionX: Number(e.target.value) })}
                  className="w-full accent-amber"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                  <span>Position Y (Zentrum)</span>
                  <span className="font-mono">{positionY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={positionY}
                  onChange={(e) => onChangePlayback({ positionY: Number(e.target.value) })}
                  className="w-full accent-amber"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Breite Bildbereich</span>
                <span className="font-mono">{liveWidthPercent}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={liveWidthPercent}
                onChange={(e) => onChangePlayback({ liveWidthPercent: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs" style={{ color: COLORS.inkDim }}>
                <span>Textausrichtung</span>
              </div>
              <div className="flex gap-2 pt-1">
                {[
                  { value: 'left', label: 'Links' },
                  { value: 'center', label: 'Mittig' },
                  { value: 'right', label: 'Rechts' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChangePlayback({ liveTextAlign: value })}
                    className={`flex-1 py-1.5 px-3 text-xs rounded-lg font-medium transition-colors ${
                      liveTextAlign === value
                        ? 'bg-amber text-zinc-950 font-bold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: COLORS.line }}>
              <input
                type="checkbox"
                id="showHeartbeat"
                checked={showHeartbeat}
                onChange={(e) => onChangePlayback({ showHeartbeat: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 accent-amber"
              />
              <label htmlFor="showHeartbeat" className="text-xs font-medium cursor-pointer" style={{ color: COLORS.ink }}>
                Pulsierender Punkt (Heartbeat) aktivieren
              </label>
            </div>
          </div>

          {/* Card 2: Stage-View (Bühnenanzeige) */}
          <div className="rounded-2xl p-5 space-y-4 shadow-sm" style={{ background: COLORS.panelBg2 }}>
            <div className="border-b pb-2 flex items-center justify-between" style={{ borderColor: COLORS.line }}>
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: COLORS.ink }}>
                Bühnenanzeige (Stage-View)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-black/5" style={{ color: COLORS.inkDim }}>
                /stage
              </span>
            </div>

            <p className="text-[11px] leading-snug" style={{ color: COLORS.inkDim }}>
              Grundeinstellungen für alle Stage-Geräte. Schriftgrösse, Kommentarspalte und vertikale Position lassen sich unter „Player-Verwaltung“ pro Gerät übersteuern.
            </p>

            <label className="flex items-center justify-between text-xs cursor-pointer" style={{ color: COLORS.inkDim }}>
              <span>Songtitel als Titelzeile anzeigen</span>
              <input
                type="checkbox"
                checked={!!playback.stageShowTitle}
                onChange={(e) => onChangePlayback({ stageShowTitle: e.target.checked })}
                className="w-4 h-4 accent-amber"
              />
            </label>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Schriftgrösse Stage-View</span>
                <span className="font-mono">{playback.stageFontSize !== undefined ? playback.stageFontSize : 64}px</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                value={playback.stageFontSize !== undefined ? playback.stageFontSize : 64}
                onChange={(e) => onChangePlayback({ stageFontSize: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Zeilenabstand Stage-View</span>
                <span className="font-mono">{playback.stageLineSpacing !== undefined ? playback.stageLineSpacing : 24}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={playback.stageLineSpacing !== undefined ? playback.stageLineSpacing : 24}
                onChange={(e) => onChangePlayback({ stageLineSpacing: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Vertikale Position Stage-View</span>
                <span className="font-mono">{stagePositionY > 0 ? `+${stagePositionY}` : stagePositionY}%</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                value={stagePositionY}
                onChange={(e) => onChangePlayback({ stagePositionY: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                  <span>Vergangene Zeilen</span>
                  <span className="font-mono">{stagePastLines}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={stagePastLines}
                  onChange={(e) => onChangePlayback({ stagePastLines: Number(e.target.value) })}
                  className="w-full accent-amber"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                  <span>Zukünftige Zeilen</span>
                  <span className="font-mono">{stageFutureLines}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={stageFutureLines}
                  onChange={(e) => onChangePlayback({ stageFutureLines: Number(e.target.value) })}
                  className="w-full accent-amber"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Bühnenvorlauf (Sekunden früher)</span>
                <span className="font-mono">{stageLeadSeconds}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={stageLeadSeconds}
                onChange={(e) => onChangePlayback({ stageLeadSeconds: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
                <span>Breite Kommentarspalte (Stage-View)</span>
                <span className="font-mono">{playback.stageCommentWidthPercent !== undefined ? playback.stageCommentWidthPercent : 20}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={playback.stageCommentWidthPercent !== undefined ? playback.stageCommentWidthPercent : 20}
                onChange={(e) => onChangePlayback({ stageCommentWidthPercent: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
