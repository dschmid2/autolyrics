import { useTheme } from '../../theme';

// List of all songs; the loaded song is highlighted
export function SongList({ songs, selectedId, onSelect, className }) {
  const { colors: COLORS } = useTheme();
  return (
    <div className={className}>
      {songs.map((s) => {
        const isSelected = s.id === selectedId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center justify-between transition-all border ${
              isSelected
                ? 'shadow-md font-bold border-amber-500/50'
                : 'opacity-85 hover:opacity-100 border-transparent hover:border-black/5 dark:hover:border-white/5'
            }`}
            style={{
              background: isSelected ? COLORS.amber : COLORS.panelBg2,
              color: isSelected ? '#241a08' : COLORS.ink,
            }}
          >
            <span className="truncate pr-2 font-medium">{s.title}</span>
            <span className="text-xs font-mono shrink-0 opacity-70">{s.bpm} BPM</span>
          </button>
        );
      })}
      {songs.length === 0 && (
        <div className="text-sm py-4 text-center rounded-xl p-3" style={{ background: COLORS.panelBg2, color: COLORS.inkDim }}>
          Keine Songs vorhanden.
        </div>
      )}
    </div>
  );
}
