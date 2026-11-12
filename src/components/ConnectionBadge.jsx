import { WifiOff } from 'lucide-react';
import { COLORS } from '../theme';

export function ConnectionBadge({ connected }) {
  if (connected) return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5" style={{ background: COLORS.danger, color: '#fff' }}>
      <WifiOff size={12} /> Keine Verbindung zum Server – versuche erneut zu verbinden…
    </div>
  );
}
