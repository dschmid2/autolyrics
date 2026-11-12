import { QrCode } from 'lucide-react';
import { COLORS } from '../theme';
import { VersionBadge } from '../components/VersionBadge';

export function UnassignedPlayerView({ playerId, playerName, serverVersion }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none cursor-none" style={{ background: COLORS.stageBg, color: COLORS.stageText }}>
      <div className="max-w-md w-full p-8 rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-2xl space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <QrCode size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">Player registriert</h2>
          <p className="text-sm text-zinc-400">
            Zuweisung fehlt noch. Bitte in der Steuerung eine Rolle (Stage oder Live) zuweisen.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Player ID</div>
          <div className="text-lg font-mono font-bold text-amber-400 select-all">{playerId}</div>
          {playerName && <div className="text-sm font-semibold text-white pt-1">{playerName}</div>}
        </div>

        <VersionBadge serverVersion={serverVersion} className="text-zinc-500" />
      </div>
    </div>
  );
}
