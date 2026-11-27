import { useRef, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme } from '../../theme';
import { defaultKeystone, CORNER_KEYS } from '../../../shared/keystone';

const CORNER_LABELS = { tl: 'oben links', tr: 'oben rechts', br: 'unten rechts', bl: 'unten links' };
// The preview shows the screen plus a margin, so corners can be pulled outwards
const MARGIN = 0.25;
const SPAN = 1 + 2 * MARGIN;
const toView = (f) => ((f + MARGIN) / SPAN) * 100;
const clampCorner = (f) => Math.min(1 + MARGIN, Math.max(-MARGIN, f));
const round = (f) => Math.round(f * 1000) / 1000;

// Keystone (trapezoid) correction for a projector device. Applies to /live on
// that device only, and only while "aktivieren" is checked.
export function PlayerKeystone({ player, onChange }) {
  const { colors: COLORS, isDark } = useTheme();
  const keystone = player.keystone || null;
  const enabled = !!(keystone && keystone.enabled);
  const [open, setOpen] = useState(enabled);
  const areaRef = useRef(null);
  const current = keystone || defaultKeystone();

  const update = (patch) => onChange({ ...current, ...patch });
  const setCorner = (key, x, y) => update({ corners: { ...current.corners, [key]: [round(clampCorner(x)), round(clampCorner(y))] } });

  const startDrag = (key) => (e) => {
    e.preventDefault();
    const area = areaRef.current;
    if (!area) return;
    e.currentTarget.focus();
    const move = (ev) => {
      const rect = area.getBoundingClientRect();
      const fx = ((ev.clientX - rect.left) / rect.width) * SPAN - MARGIN;
      const fy = ((ev.clientY - rect.top) / rect.height) * SPAN - MARGIN;
      setCorner(key, fx, fy);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Fine adjustment: arrow keys move the focused corner (Shift = bigger steps)
  const onKey = (key) => (e) => {
    const step = e.shiftKey ? 0.01 : 0.002;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!delta) return;
    e.preventDefault();
    const [x, y] = current.corners[key];
    setCorner(key, x + delta[0], y + delta[1]);
  };

  const points = CORNER_KEYS.map((k) => `${toView(current.corners[k][0])},${toView(current.corners[k][1])}`).join(' ');

  return (
    <div className="border-t pt-2" style={{ borderColor: COLORS.line }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-xs font-medium py-1"
        style={{ color: COLORS.inkDim }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Trapez-Entzerrung (Beamer)
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${enabled ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold' : ''}`}
          style={enabled ? undefined : { color: COLORS.inkDim }}
        >
          {enabled ? 'aktiv' : 'aus'}
        </span>
      </button>

      {open && (
        <div className="space-y-2 pt-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: COLORS.ink }}>
            <input type="checkbox" checked={enabled} onChange={(e) => update({ enabled: e.target.checked })} />
            Entzerrung aktivieren (nur Live-Ansicht dieses Geräts)
          </label>

          {enabled && (
            <>
              <p className="text-[11px] leading-snug" style={{ color: COLORS.inkDim }}>
                Ecken ziehen, bis das Testraster auf der Leinwand rechtwinklig ist und der Kreis rund. Feinjustierung: Ecke anklicken, dann Pfeiltasten (mit Shift grösser).
              </p>
              <div
                ref={areaRef}
                className="relative w-full rounded-lg overflow-hidden select-none touch-none"
                style={{ aspectRatio: '16 / 9', background: isDark ? '#0A0A0D' : '#221F1A' }}
              >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <rect
                    x={toView(0)} y={toView(0)} width={toView(1) - toView(0)} height={toView(1) - toView(0)}
                    fill="none" stroke="#9AA0AE" strokeDasharray="1.5 1.5" strokeWidth="1" vectorEffect="non-scaling-stroke"
                  />
                  <polygon points={points} fill="#D89A3E" fillOpacity="0.18" stroke="#D89A3E" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </svg>
                {CORNER_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onPointerDown={startDrag(k)}
                    onKeyDown={onKey(k)}
                    aria-label={`Ecke ${CORNER_LABELS[k]} verschieben`}
                    title={`Ecke ${CORNER_LABELS[k]}`}
                    className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 cursor-move focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ left: `${toView(current.corners[k][0])}%`, top: `${toView(current.corners[k][1])}%`, background: '#D89A3E', borderColor: '#F4EFE4', touchAction: 'none' }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: COLORS.ink }}>
                  <input type="checkbox" checked={!!current.showGrid} onChange={(e) => update({ showGrid: e.target.checked })} />
                  Testraster auf dem Beamer anzeigen
                </label>
                <button
                  type="button"
                  onClick={() => update({ corners: defaultKeystone().corners })}
                  className="text-[11px] underline"
                  style={{ color: COLORS.inkDim }}
                >
                  Ecken zurücksetzen
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
