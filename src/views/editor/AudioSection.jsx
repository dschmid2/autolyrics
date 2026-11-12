import { useState, useRef } from 'react';
import { Music, Upload, Trash2 } from 'lucide-react';
import { useTheme } from '../../theme';
import { WaveformEditor } from './waveform/WaveformEditor';

// MP3 upload/removal and, if a file is linked, the waveform editor
export function AudioSection({ song, computedLines, onUpdate, onPlaybackStateChange, seekRef, playback, sendPlayback }) {
  const { colors: COLORS } = useTheme();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('audio', file);
    setUploading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload fehlgeschlagen');
      const data = await res.json();
      onUpdate({ audioUrl: data.url, audioName: data.originalName });
    } catch (err) {
      alert('Fehler beim Hochladen der MP3-Datei: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAudio = () => {
    onUpdate({ audioUrl: null, audioName: null });
  };

  return (
    <div className="rounded-xl p-3 space-y-3 border" style={{ background: COLORS.panelBg2, borderColor: COLORS.line }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Music size={18} style={{ color: COLORS.ink }} />
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>
            MP3 Audio-Datei
          </span>
          {song.audioName && (
            <span className="text-xs px-2 py-0.5 rounded font-mono truncate max-w-xs border" style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}>
              {song.audioName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="audio/mp3,audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={uploading}
            className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium disabled:opacity-50"
            style={{ background: COLORS.amber, color: '#241a08' }}
          >
            <Upload size={14} /> {uploading ? 'Lädt hoch…' : song.audioUrl ? 'MP3 ersetzen' : 'MP3 hochladen'}
          </button>
          {song.audioUrl && (
            <button
              onClick={removeAudio}
              className="text-xs px-2 py-1.5 rounded-lg text-white font-medium"
              style={{ background: COLORS.danger }}
              title="MP3 löschen"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {song.audioUrl ? (
        <WaveformEditor
          song={song}
          computedLines={computedLines}
          onUpdateSong={onUpdate}
          onPlaybackStateChange={onPlaybackStateChange}
          seekRef={seekRef}
          playback={playback}
          sendPlayback={sendPlayback}
        />
      ) : (
        <div className="p-4 text-center border-2 border-dashed rounded-lg text-xs" style={{ borderColor: COLORS.line, color: COLORS.inkDim }}>
          Keine MP3-Datei verknüpft. Lade eine MP3 hoch, um die interaktive Wellenform mit Zeitstempel-Markern zu nutzen.
        </div>
      )}
    </div>
  );
}
