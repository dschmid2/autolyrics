import { useState } from 'react';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useTheme } from '../../theme';
import { uid } from '../../lib/ids';
import { ImportExport } from './ImportExport';
import { SongEditor } from './SongEditor';

export function EditorView({ songs, onChangeSongs, playback, sendPlayback }) {
  const { colors: COLORS } = useTheme();
  const [selectedId, setSelectedId] = useState(songs[0] ? songs[0].id : null);
  const selected = songs.find((s) => s.id === selectedId) || null;

  const addSong = () => {
    const s = { id: uid(), title: 'Neuer Song', bpm: 90, timingMode: 'bar_beat', lines: [] };
    onChangeSongs([...songs, s]);
    setSelectedId(s.id);
  };
  const updateSong = (next) => onChangeSongs(songs.map((s) => (s.id === next.id ? next : s)));
  const deleteSong = (id) => {
    onChangeSongs(songs.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const moveSong = (id, direction) => {
    const index = songs.findIndex((s) => s.id === id);
    if (index === -1) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= songs.length) return;
    const updated = [...songs];
    const [moved] = updated.splice(index, 1);
    updated.splice(nextIndex, 0, moved);
    onChangeSongs(updated);
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.panelBg }}>
      <div className="max-w-[1200px] w-full mx-auto p-4 md:px-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: COLORS.ink }}>Songs verwalten</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-64 shrink-0 space-y-2">
            <div className="space-y-2 max-h-48 md:max-h-none overflow-y-auto pr-1">
            {songs.map((s, index) => (
              <div
                key={s.id}
                className="flex items-center gap-1 w-full rounded-lg pr-1 border"
                style={{
                  background: s.id === selectedId ? COLORS.amber : COLORS.panelBg2,
                  borderColor: s.id === selectedId ? 'transparent' : COLORS.line,
                }}
              >
                <button
                  onClick={() => setSelectedId(s.id)}
                  className="flex-1 text-left px-3 py-2 text-sm font-medium truncate"
                  style={{ color: s.id === selectedId ? '#241a08' : COLORS.ink }}
                >
                  {s.title}
                </button>
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSong(s.id, -1); }}
                    disabled={index === 0}
                    className="p-0.5 hover:bg-black/10 rounded disabled:opacity-30"
                    title="Nach oben verschieben"
                  >
                    <ChevronUp size={14} color={s.id === selectedId ? '#241a08' : COLORS.ink} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveSong(s.id, 1); }}
                    disabled={index === songs.length - 1}
                    className="p-0.5 hover:bg-black/10 rounded disabled:opacity-30"
                    title="Nach unten verschieben"
                  >
                    <ChevronDown size={14} color={s.id === selectedId ? '#241a08' : COLORS.ink} />
                  </button>
                </div>
              </div>
            ))}
            </div>
            <button onClick={addSong} className="w-full text-sm px-3 py-2 rounded-lg flex items-center justify-center gap-1" style={{ background: COLORS.ink, color: COLORS.panelBg }}><Plus size={14} /> Neuer Song</button>
          </div>
          <div className="flex-1 min-w-0">
            {selected ? (
              <SongEditor
                song={selected}
                onChange={updateSong}
                onDelete={() => deleteSong(selected.id)}
                playback={playback}
                sendPlayback={sendPlayback}
              />
            ) : (
              <div className="text-sm" style={{ color: COLORS.inkDim }}>Song auswählen oder neu erstellen.</div>
            )}
            <ImportExport songs={songs} onImport={onChangeSongs} />
          </div>
        </div>
      </div>
    </div>
  );
}
