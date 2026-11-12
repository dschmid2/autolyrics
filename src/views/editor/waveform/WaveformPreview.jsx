import { Clock } from 'lucide-react';
import { fmtTimeWithTenths } from '../../../lib/timing';

// Banner above the waveform: line at the playhead and the local clock
export function WaveformPreview({ activeLine, currentTime, bpm, timeSigNum }) {
  const totalBeats = currentTime * (bpm / 60);
  const currentBar = Math.floor(totalBeats / timeSigNum) + 1;
  const currentBeat = Math.floor(totalBeats % timeSigNum) + 1;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
      <div className="md:col-span-2 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Vorschau (Aktuelle Zeile)</div>
        <div className="text-base font-semibold truncate text-zinc-100">
          {activeLine ? activeLine.en : <span className="text-zinc-500 italic">— Schwarz / Pause —</span>}
        </div>
        {activeLine && activeLine.de && (
          <div className="text-xs text-zinc-400 truncate">{activeLine.de}</div>
        )}
      </div>

      <div className="flex flex-col justify-center space-y-1 md:border-l md:border-zinc-800 md:pl-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
          <Clock size={12} /> Live-Uhr
        </div>
        <div className="text-sm font-mono font-bold text-amber-400">
          {fmtTimeWithTenths(currentTime)} <span className="text-xs text-zinc-400">({currentTime.toFixed(1)}s)</span>
        </div>
        <div className="text-xs font-mono text-zinc-300">
          Takt <span className="text-amber-400 font-bold">{currentBar}</span>, Schlag <span className="text-amber-400 font-bold">{currentBeat}</span> / {timeSigNum}
        </div>
      </div>
    </div>
  );
}
