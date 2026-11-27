import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { useTheme } from '../../theme';
import { loadSyncUrl, saveSyncUrl, previewSync, importFromInstance } from '../../lib/instanceSync';

const STATUS_LABEL = { new: 'Neu', changed: 'Geändert', same: 'Unverändert' };

function summarize(result) {
  const parts = [`${result.added} neu`, `${result.updated} aktualisiert`];
  if (result.audioDownloaded) parts.push(`${result.audioDownloaded} MP3 geladen`);
  let text = `Import abgeschlossen: ${parts.join(', ')}.`;
  if (result.audioFailed.length) {
    text += ` ${result.audioFailed.length} MP3 konnten nicht geladen werden (${result.audioFailed.map((f) => f.fileName).join(', ')}).`;
  } else if (result.audioMissing) {
    text += ` ${result.audioMissing} Songs ohne MP3 übernommen.`;
  }
  return text;
}

// Pulls songs (and optionally MP3s) from another Autolyrics instance.
// Known song ids are updated, unknown ones added; local-only songs are kept.
export function InstanceSync() {
  const { colors: COLORS, isDark } = useTheme();
  const [url, setUrl] = useState(loadSyncUrl);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(null); // 'preview' | 'import' | null
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const connect = async () => {
    setBusy('preview');
    setError(null);
    setMessage(null);
    try {
      const data = await previewSync(url);
      saveSyncUrl(data.origin);
      setUrl(data.origin);
      setPreview(data);
      // Default: everything that would change something here
      const next = {};
      data.songs.forEach((s) => { next[s.id] = s.status !== 'same' || (includeAudio && s.audio === 'missing'); });
      setSelected(next);
    } catch (e) {
      setPreview(null);
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const selectedIds = preview ? preview.songs.filter((s) => selected[s.id]).map((s) => s.id) : [];

  const runImport = async () => {
    setBusy('import');
    setError(null);
    setMessage(null);
    try {
      const result = await importFromInstance(preview.origin, selectedIds, includeAudio);
      setMessage(summarize(result));
      // Show the new state (everything imported is now "same")
      const data = await previewSync(preview.origin);
      setPreview(data);
      setSelected({});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const setAll = (value) => {
    const next = {};
    preview.songs.forEach((s) => { next[s.id] = value; });
    setSelected(next);
  };

  const counts = preview
    ? preview.songs.reduce((acc, s) => ({ ...acc, [s.status]: (acc[s.status] || 0) + 1 }), {})
    : {};
  const statusColor = (status) => (status === 'new' ? '#15803d' : status === 'changed' ? '#b45309' : COLORS.inkDim);
  const statusColorDark = (status) => (status === 'new' ? '#4ade80' : status === 'changed' ? '#fbbf24' : COLORS.inkDim);

  return (
    <div className="space-y-3 pt-4 mt-4 border-t" style={{ borderColor: COLORS.line }}>
      <div className="text-xs uppercase tracking-wide font-bold" style={{ color: COLORS.inkDim }}>
        Von anderer Instanz synchronisieren
      </div>
      <p className="text-xs" style={{ color: COLORS.inkDim }}>
        Holt Songs von einer anderen Autolyrics-Instanz (z. B. vom NAS auf den Raspberry Pi). Bekannte Songs werden aktualisiert, neue hinzugefügt; Songs, die es nur hier gibt, bleiben erhalten.
      </p>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && url.trim() && !busy) connect(); }}
          placeholder="Adresse der anderen Instanz, z. B. http://nas.local:8080"
          aria-label="Adresse der anderen Instanz"
          className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg text-sm border font-mono"
          style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
        />
        <button
          onClick={connect}
          disabled={!url.trim() || !!busy}
          className="text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          style={{ background: COLORS.ink, color: COLORS.panelBg }}
        >
          {busy === 'preview' ? 'Verbinde…' : 'Verbinden'}
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: COLORS.ink }}>
        <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} />
        MP3-Dateien mit übertragen
      </label>

      {error && (
        <div className="text-xs px-3 py-2 rounded-lg" role="alert" style={{ background: COLORS.danger, color: '#fff' }}>
          {error}
        </div>
      )}
      {message && (
        <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 border" style={{ background: COLORS.cardBg, borderColor: COLORS.line, color: COLORS.ink }}>
          <Check size={14} className="shrink-0" /> {message}
        </div>
      )}

      {preview && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs" style={{ color: COLORS.inkDim }}>
            <span>
              {preview.songs.length} Songs auf {preview.origin}
              {preview.appVersion ? ` (v${preview.appVersion})` : ''}: {counts.new || 0} neu, {counts.changed || 0} geändert, {counts.same || 0} unverändert
            </span>
            <span className="flex gap-2">
              <button className="underline" onClick={() => setAll(true)}>Alle</button>
              <button className="underline" onClick={() => setAll(false)}>Keine</button>
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border divide-y" style={{ borderColor: COLORS.line, background: COLORS.cardBg }}>
            {preview.songs.length === 0 && (
              <div className="p-3 text-xs" style={{ color: COLORS.inkDim }}>Die andere Instanz hat keine Songs.</div>
            )}
            {preview.songs.map((s) => (
              <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer" style={{ borderColor: COLORS.line, color: COLORS.ink }}>
                <input
                  type="checkbox"
                  checked={!!selected[s.id]}
                  onChange={(e) => setSelected({ ...selected, [s.id]: e.target.checked })}
                />
                <span className="flex-1 min-w-0 truncate">{s.title || '(ohne Titel)'}</span>
                <span className="text-xs shrink-0" style={{ color: COLORS.inkDim }}>{s.lineCount} Zeilen</span>
                {s.audio !== 'none' && (
                  <span className="text-xs shrink-0" style={{ color: COLORS.inkDim }} title={s.audioName}>
                    {s.audio === 'local' ? 'MP3 vorhanden' : 'MP3 fehlt hier'}
                  </span>
                )}
                <span className="text-xs font-semibold shrink-0 w-24 text-right" style={{ color: isDark ? statusColorDark(s.status) : statusColor(s.status) }}>
                  {STATUS_LABEL[s.status]}
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={runImport}
            disabled={selectedIds.length === 0 || !!busy}
            className="text-sm px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium disabled:opacity-50"
            style={{ background: COLORS.amber, color: '#241a08' }}
          >
            <Download size={14} />
            {busy === 'import' ? 'Importiere…' : `${selectedIds.length} ${selectedIds.length === 1 ? 'Song' : 'Songs'} importieren`}
          </button>
        </div>
      )}
    </div>
  );
}
