import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme';
import { getSetting } from '../lib/playback';
import { RangeSetting } from '../components/form/RangeSetting';

export function OptionsView({ playback, onChangePlayback }) {
  const { colors: COLORS, theme, setTheme } = useTheme();
  const fontSize = getSetting(playback, 'fontSize');
  const translationPercent = getSetting(playback, 'translationPercent');
  const translationSpacing = getSetting(playback, 'translationSpacing');
  const positionX = getSetting(playback, 'positionX');
  const positionY = getSetting(playback, 'positionY');
  const liveWidthPercent = getSetting(playback, 'liveWidthPercent');
  const liveTextAlign = playback.liveTextAlign || 'center';
  const showHeartbeat = getSetting(playback, 'showHeartbeat');
  const autoNextSong = getSetting(playback, 'autoNextSong') !== false;
  const autoNextDelaySeconds = getSetting(playback, 'autoNextDelaySeconds');
  const stagePastLines = getSetting(playback, 'stagePastLines');
  const stageFutureLines = getSetting(playback, 'stageFutureLines');
  const stageLeadSeconds = getSetting(playback, 'stageLeadSeconds');
  const stagePositionY = getSetting(playback, 'stagePositionY');

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
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
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
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
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

            <RangeSetting
              label="Schriftgrösse Projektion"
              value={fontSize}
              display={`${fontSize}px`}
              min={20}
              max={120}
              onChange={(v) => onChangePlayback({ fontSize: v })}
            />

            <RangeSetting
              label="Grösse Übersetzung"
              value={translationPercent}
              display={`${translationPercent}%`}
              min={30}
              max={100}
              onChange={(v) => onChangePlayback({ translationPercent: v })}
            />

            <RangeSetting
              label="Abstand zwischen Text und Übersetzung"
              value={translationSpacing}
              display={`${translationSpacing}px`}
              min={0}
              max={100}
              onChange={(v) => onChangePlayback({ translationSpacing: v })}
            />

            <div className="grid grid-cols-2 gap-3">
              <RangeSetting
                label="Position X (Zentrum)"
                value={positionX}
                display={`${positionX}%`}
                min={0}
                max={100}
                onChange={(v) => onChangePlayback({ positionX: v })}
              />
              <RangeSetting
                label="Position Y (Zentrum)"
                value={positionY}
                display={`${positionY}%`}
                min={0}
                max={100}
                onChange={(v) => onChangePlayback({ positionY: v })}
              />
            </div>

            <RangeSetting
              label="Breite Bildbereich"
              value={liveWidthPercent}
              display={`${liveWidthPercent}%`}
              min={10}
              max={100}
              onChange={(v) => onChangePlayback({ liveWidthPercent: v })}
            />

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
                        ? 'text-zinc-950 font-bold'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                    style={liveTextAlign === value ? { background: COLORS.amber } : undefined}
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

            <RangeSetting
              label="Schriftgrösse Stage-View"
              value={getSetting(playback, 'stageFontSize')}
              display={`${getSetting(playback, 'stageFontSize')}px`}
              min={20}
              max={120}
              onChange={(v) => onChangePlayback({ stageFontSize: v })}
            />

            <RangeSetting
              label="Zeilenabstand Stage-View"
              value={getSetting(playback, 'stageLineSpacing')}
              display={`${getSetting(playback, 'stageLineSpacing')}px`}
              min={0}
              max={80}
              onChange={(v) => onChangePlayback({ stageLineSpacing: v })}
            />

            <RangeSetting
              label="Vertikale Position Stage-View"
              value={stagePositionY}
              display={<>{stagePositionY > 0 ? `+${stagePositionY}` : stagePositionY}%</>}
              min={-50}
              max={50}
              onChange={(v) => onChangePlayback({ stagePositionY: v })}
            />

            <div className="grid grid-cols-2 gap-3">
              <RangeSetting
                label="Vergangene Zeilen"
                value={stagePastLines}
                min={0}
                max={5}
                onChange={(v) => onChangePlayback({ stagePastLines: v })}
              />
              <RangeSetting
                label="Zukünftige Zeilen"
                value={stageFutureLines}
                min={0}
                max={5}
                onChange={(v) => onChangePlayback({ stageFutureLines: v })}
              />
            </div>

            <RangeSetting
              label="Bühnenvorlauf (Sekunden früher)"
              value={stageLeadSeconds}
              display={`${stageLeadSeconds}s`}
              min={0}
              max={10}
              step={0.5}
              onChange={(v) => onChangePlayback({ stageLeadSeconds: v })}
              className="space-y-1 pt-1"
            />

            <RangeSetting
              label="Breite Kommentarspalte (Stage-View)"
              value={getSetting(playback, 'stageCommentWidthPercent')}
              display={`${getSetting(playback, 'stageCommentWidthPercent')}%`}
              min={0}
              max={100}
              onChange={(v) => onChangePlayback({ stageCommentWidthPercent: v })}
              className="space-y-1 pt-1"
            />
          </div>

          {/* Card 3: Wiedergabe */}
          <div className="rounded-2xl p-5 space-y-4 shadow-sm lg:col-span-2" style={{ background: COLORS.panelBg2 }}>
            <div className="border-b pb-2" style={{ borderColor: COLORS.line }}>
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: COLORS.ink }}>
                Wiedergabe
              </h2>
            </div>

            <label className="flex items-center justify-between gap-3 text-xs cursor-pointer" style={{ color: COLORS.inkDim }}>
              <span>Nach Songende automatisch den nächsten Song laden (gestoppt, am Anfang)</span>
              <input
                type="checkbox"
                checked={autoNextSong}
                onChange={(e) => onChangePlayback({ autoNextSong: e.target.checked })}
                className="w-4 h-4 accent-amber shrink-0"
              />
            </label>

            {autoNextSong && (
              <RangeSetting
                label="Wartezeit nach Songende"
                value={autoNextDelaySeconds}
                display={`${autoNextDelaySeconds}s`}
                min={0}
                max={30}
                step={1}
                onChange={(v) => onChangePlayback({ autoNextDelaySeconds: v })}
              />
            )}

            <p className="text-[11px] leading-snug" style={{ color: COLORS.inkDim }}>
              Ein Song endet mit der letzten Zeile plus deren Dauer (ohne Angabe 4 Sekunden). Nach dem letzten Song der Liste passiert nichts. Gilt nur für die Steuerung, nicht für „Send to screens“ im Song-Editor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
