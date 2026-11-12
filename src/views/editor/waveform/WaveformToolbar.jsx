import { Play, Pause, Square, SkipBack, SkipForward, Plus, ZoomIn, ZoomOut, Tv } from 'lucide-react';
import { COLORS } from '../../../theme';
import { fmtTimeWithTenths } from '../../../lib/timing';

// Transport buttons, marker tools, audio offset, drag mode, "send to screens" and zoom
export function WaveformToolbar({
  isPlaying, currentTime, onTogglePlay, onStop, onNudge, onAddMarker,
  song, onUpdateSong, markerDragMode, onMarkerDragModeChange,
  sendToScreens, onToggleSendToScreens, pxPerSec, onZoomChange,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium"
          style={{ background: COLORS.amber, color: '#241a08' }}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pause' : 'Abspielen'}
        </button>
        <button
          onClick={onStop}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          title="Stopp"
        >
          <Square size={14} />
        </button>
        <button
          onClick={() => onNudge(-5)}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          title="5s zurück"
        >
          <SkipBack size={14} />
        </button>
        <button
          onClick={() => onNudge(5)}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          title="5s vor"
        >
          <SkipForward size={14} />
        </button>

        <button
          onClick={onAddMarker}
          className="ml-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-medium flex items-center gap-1 border border-zinc-700"
        >
          <Plus size={14} /> Marker setzen ({fmtTimeWithTenths(currentTime)})
        </button>

        <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded-lg text-xs" title="Audio Startzeitpunkt im Song verschieben (positiv = Audio startet später, negativ = Audio startet früher)">
          <span className="text-zinc-300 font-medium">Audio-Offset:</span>
          <input
            type="number"
            step="0.1"
            value={song.audioOffset !== undefined && song.audioOffset !== null ? song.audioOffset : 0}
            onChange={(e) => onUpdateSong({ audioOffset: Number(e.target.value) || 0 })}
            className="w-16 px-1.5 py-0.5 rounded bg-zinc-900 text-amber-400 font-mono text-xs border border-zinc-700 text-right"
          />
          <span className="text-zinc-400 font-mono text-[10px]">s</span>
        </div>

        <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 p-0.5 rounded-lg text-xs" title="Bearbeitungsmodus für Marker-Verschiebung">
          <span className="text-zinc-400 font-medium px-1.5 text-[11px]">Verschiebe-Modus:</span>
          <button
            onClick={() => onMarkerDragModeChange('single')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              markerDragMode === 'single'
                ? 'bg-amber-500 text-black font-semibold'
                : 'text-zinc-300 hover:text-white'
            }`}
            title="Nur den ausgewählten Marker verschieben"
          >
            Nur dieser Marker
          </button>
          <button
            onClick={() => onMarkerDragModeChange('following')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              markerDragMode === 'following'
                ? 'bg-amber-500 text-black font-semibold'
                : 'text-zinc-300 hover:text-white'
            }`}
            title="Diesen und alle folgenden Marker verschieben"
          >
            Dieser &amp; folgende
          </button>
        </div>

        <button
          onClick={onToggleSendToScreens}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
            sendToScreens
              ? 'bg-amber-500 text-black border-amber-400 font-semibold shadow-sm'
              : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-700'
          }`}
          title="Texte während des MP3-Playbacks live an Stage- und Projection-Screens senden"
        >
          <Tv size={14} className={sendToScreens ? 'text-black' : 'text-zinc-400'} />
          <span>Send to screens</span>
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-2 text-xs text-zinc-300">
        <ZoomOut size={14} className="text-zinc-400" />
        <input
          type="range"
          min="15"
          max="250"
          value={pxPerSec}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-24 accent-amber-500 cursor-pointer"
          title="Wellenform Zoom"
        />
        <ZoomIn size={14} className="text-zinc-400" />
        <span className="font-mono text-[10px] text-zinc-400">{pxPerSec}px/s</span>
      </div>
    </div>
  );
}
