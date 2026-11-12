import { ChevronUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useTheme } from '../../theme';
import { fmtTime } from '../../lib/timing';

// One editable lyric line (text, translation, cue, timing, duration, actions).
// Clicking the row moves the waveform playhead to its marker.
export function LineRow({
  line: l, lineNum, t, timingMode, timeSigNum, isPlayingActive, rowRef,
  onJump, onChange, onBarChange, onInsertAfter, onMove, onRemove,
}) {
  const { colors: COLORS, isDark } = useTheme();
  return (
    <div
        ref={rowRef}
      onClick={onJump}
      className={`rounded-lg p-2 space-y-1 transition-all border ${
        isPlayingActive ? 'ring-2 ring-amber-500 shadow-md border-amber-500/50' : ''
      }`}
      style={{
        background: isPlayingActive ? (isDark ? '#423214' : '#FDE047') : COLORS.panelBg2,
        borderColor: isPlayingActive ? COLORS.amber : COLORS.line,
        color: COLORS.ink,
      }}
    >
      <div className="flex gap-2 items-center">
        <span
          className={`font-mono text-xs font-bold px-2 py-1 rounded shrink-0 select-none ${
            isPlayingActive ? 'bg-amber-400 text-black shadow-sm' : ''
          }`}
          style={{
            background: isPlayingActive ? COLORS.amber : COLORS.line,
            color: isPlayingActive ? '#241a08' : COLORS.ink,
          }}
          title={`Marker #${lineNum}`}
        >
          #{lineNum}
        </span>
        <input
          value={l.en}
          onChange={(e) => onChange({ en: e.target.value })}
          placeholder="Englisch / Haupttext"
          className="flex-1 px-2 py-1 rounded text-sm border"
          style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
        />
        <input
          value={l.comment || ''}
          onChange={(e) => onChange({ comment: e.target.value })}
          placeholder="[Kommentar / Solo]"
          className="w-36 px-2 py-1 rounded text-xs border"
          style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
          title="Kommentar für Solosänger (wird im Stagedisplay links angezeigt)"
        />
        <label className="flex items-center gap-1 text-xs font-medium cursor-pointer whitespace-nowrap" style={{ color: COLORS.inkDim }} title="Nur im Stageview anzeigen (*), nie auf der Projektion">
          <input
            type="checkbox"
            checked={!!l.stageOnly}
            onChange={(e) => onChange({ stageOnly: e.target.checked })}
            className="rounded accent-amber"
          />
          <span>Nur Stage (*)</span>
        </label>
      </div>
      <input
        value={l.de || ''}
        onChange={(e) => onChange({ de: e.target.value })}
        placeholder="Deutsch (Übersetzung)"
        className="w-full px-2 py-1 rounded text-sm border"
        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
      />
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <select
          value={l.mode || timingMode}
          onChange={(e) => onChange({ mode: e.target.value })}
          className="px-1.5 py-1 rounded text-xs border"
          style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
        >
          <option value="bar_beat">Takt / Schlag</option>
          <option value="sec">Absolut (Sekunden)</option>
          <option value="relative">Relativ (s seit letzter)</option>
          <option value="beat">Schlag absolut</option>
          <option value="relative_bar_beat">Relativ (Takt / Schlag)</option>
        </select>

        {l.mode === 'sec' && (
          <div className="flex items-center gap-1">
            <span style={{ color: COLORS.inkDim }}>s:</span>
            <input
              type="number"
              step="0.1"
              value={l.timeSec !== undefined && l.timeSec !== null ? l.timeSec : ''}
              onChange={(e) => onChange({ timeSec: e.target.value })}
              className="w-16 px-1.5 py-1 rounded border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
          </div>
        )}

        {l.mode === 'relative' && (
          <div className="flex items-center gap-1">
            <span style={{ color: COLORS.inkDim }}>+s:</span>
            <input
              type="number"
              step="0.1"
              value={l.relativeSec !== undefined && l.relativeSec !== null ? l.relativeSec : ''}
              onChange={(e) => onChange({ relativeSec: e.target.value })}
              className="w-16 px-1.5 py-1 rounded border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
          </div>
        )}

        {l.mode === 'relative_bar_beat' && (
          <div className="flex items-center gap-1">
            <span style={{ color: COLORS.inkDim }}>+Takt:</span>
            <input
              type="number"
              step="1"
              value={l.relativeBar !== undefined && l.relativeBar !== null ? l.relativeBar : ''}
              onChange={(e) => onChange({ relativeBar: e.target.value })}
              className="w-12 px-1.5 py-1 rounded border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
            <span style={{ color: COLORS.inkDim }}>+Schlag:</span>
            <input
              type="number"
              step="1"
              value={l.relativeBeat !== undefined && l.relativeBeat !== null ? l.relativeBeat : ''}
              onChange={(e) => onChange({ relativeBeat: e.target.value })}
              className="w-12 px-1.5 py-1 rounded border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
          </div>
        )}

        {(l.mode === 'bar_beat' || !l.mode) && (
          <div className="flex items-center gap-1">
            <span style={{ color: COLORS.inkDim }}>Takt:</span>
            <input
              type="number"
              step="1"
              min="1"
              value={l.bar !== undefined && l.bar !== null ? l.bar : 1}
              onChange={(e) => onBarChange(e.target.value)}
              className="w-12 px-1.5 py-1 rounded border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
            <span style={{ color: COLORS.inkDim }}>Schlag:</span>
            <input
              type="number"
              step="1"
              min="1"
              max={timeSigNum || 4}
              value={l.beat !== undefined && l.beat !== null ? l.beat : 1}
              onChange={(e) => onChange({ beat: e.target.value })}
              className="w-12 px-1.5 py-1 rounded border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
          </div>
        )}

        {l.mode === 'beat' && (
          <div className="flex items-center gap-1">
            <span style={{ color: COLORS.inkDim }}>Schlag:</span>
            <input
              type="number"
              step="1"
              min="1"
              value={l.beat !== undefined && l.beat !== null ? l.beat : 1}
              onChange={(e) => onChange({ beat: e.target.value })}
              className="w-16 px-1.5 py-1 rounded border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
          </div>
        )}

        <div className="flex items-center gap-1">
          <span style={{ color: COLORS.inkDim }} title="Anzeigedauer in Sekunden">Dauer (s):</span>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="∞"
            value={l.duration !== undefined && l.duration !== null ? l.duration : ''}
            onChange={(e) => onChange({ duration: e.target.value })}
            className="w-14 px-1.5 py-1 rounded border"
            style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
          />
        </div>

        <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>≈ {fmtTime(t)}</span>

        <div className="flex gap-1 ml-auto">
          <button
            onClick={onInsertAfter}
            title="Zeile danach einfügen"
            aria-label="Zeile danach einfügen"
            className="p-1 rounded hover:opacity-80 border"
            style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => onMove(-1)}
            aria-label="Zeile nach oben"
            className="p-1 rounded hover:opacity-80 border"
            style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => onMove(1)}
            aria-label="Zeile nach unten"
            className="p-1 rounded hover:opacity-80 border"
            style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={onRemove}
            aria-label="Zeile löschen"
            className="p-1 rounded hover:opacity-80 border"
            style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
          >
            <Trash2 size={14} color={COLORS.danger} />
          </button>
        </div>
      </div>
    </div>
  );
}
