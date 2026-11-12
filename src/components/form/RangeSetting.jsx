import { useTheme } from '../../theme';

// Labelled slider with the current value shown on the right
export function RangeSetting({ label, value, display, min, max, step, onChange, className = 'space-y-1' }) {
  const { colors: COLORS } = useTheme();
  return (
    <div className={className}>
      <div className="flex justify-between text-xs" style={{ color: COLORS.inkDim }}>
        <span>{label}</span>
        <span className="font-mono">{display !== undefined ? display : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber"
      />
    </div>
  );
}
