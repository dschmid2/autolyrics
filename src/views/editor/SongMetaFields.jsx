import { Trash2 } from 'lucide-react';
import { useTheme } from '../../theme';

// Title, BPM, time signature, timing mode and delete button of a song
export function SongMetaFields({ song, onUpdate, onTimingModeChange, onDelete }) {
  const { colors: COLORS } = useTheme();
  return (
    <div className="flex gap-2 flex-wrap md:flex-nowrap">
      <input
        value={song.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="Songtitel"
        className="flex-1 min-w-[150px] px-3 py-2 rounded-lg text-sm font-semibold border"
        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
      />
      <div className="flex items-center gap-1.5 shrink-0 rounded-lg p-1 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
        <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>BPM</span>
        <input
          type="number"
          value={song.bpm}
          onChange={(e) => onUpdate({ bpm: Number(e.target.value) || 1 })}
          placeholder="BPM"
          className="w-16 px-1.5 py-1 rounded text-sm border"
          style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
        />
      </div>
      <div className="flex items-center gap-1.5 shrink-0 rounded-lg p-1 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
        <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>Taktart</span>
        <select
          value={`${song.timeSigNum || 4}/${song.timeSigDen || 4}`}
          onChange={(e) => {
            const [num, den] = e.target.value.split('/');
            onUpdate({ timeSigNum: Number(num), timeSigDen: Number(den) });
          }}
          className="px-1.5 py-1 rounded text-sm cursor-pointer border"
          style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
        >
          <option value="4/4">4/4</option>
          <option value="3/4">3/4</option>
          <option value="2/4">2/4</option>
          <option value="6/8">6/8</option>
          <option value="5/4">5/4</option>
        </select>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 rounded-lg p-1 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
        <span className="text-xs font-semibold px-1" style={{ color: COLORS.inkDim }}>Positionierung</span>
        <select
          value={song.timingMode || 'bar_beat'}
          onChange={(e) => onTimingModeChange(e.target.value)}
          className="px-1.5 py-1 rounded text-sm cursor-pointer border"
          style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
        >
          <option value="bar_beat">Takt / Schlag</option>
          <option value="sec">Zeitbasis (Sekunden)</option>
        </select>
      </div>
      <button
        onClick={onDelete}
        aria-label="Song löschen"
        className="px-3 py-2 rounded-lg shrink-0"
        style={{ background: COLORS.danger }}
      >
        <Trash2 size={16} color="#fff" />
      </button>
    </div>
  );
}
