import { useTheme } from '../../theme';

const MODES = [
  { value: 'single', label: 'Nur diese Zeile', title: 'Nur die bearbeitete Zeile bzw. den gezogenen Marker verschieben' },
  { value: 'following', label: 'Diese & folgende', title: 'Diese und alle zeitlich folgenden Zeilen um denselben Betrag verschieben' },
];

// Whether changing a line's time moves only that line or all following ones too.
// Same setting as "Verschiebe-Modus" in the waveform toolbar.
export function ShiftModeToggle({ mode, onChange }) {
  const { colors: COLORS } = useTheme();
  return (
    <div
      className="flex items-center gap-1 p-0.5 rounded-lg text-xs border"
      style={{ background: COLORS.cardBg, borderColor: COLORS.line }}
      title="Gilt für Takt, Schlag und Sekunden in den Zeilen und für die Marker auf der Wellenform"
    >
      <span className="px-1.5 text-[11px] font-medium" style={{ color: COLORS.inkDim }}>Verschiebe-Modus:</span>
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(m.value)}
          aria-pressed={mode === m.value}
          title={m.title}
          className="px-2 py-0.5 rounded text-[11px] font-medium"
          style={mode === m.value
            ? { background: COLORS.amber, color: '#241a08', fontWeight: 600 }
            : { color: COLORS.ink }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
