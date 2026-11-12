import { useState, useRef } from 'react';
import { Copy, Check, Upload, Download } from 'lucide-react';
import { useTheme } from '../../theme';
import { uid } from '../../lib/ids';
import { parsePlaintextSongLines } from '../../lib/plaintextImport';

export function ImportExport({ songs, onImport }) {
  const { colors: COLORS, isDark } = useTheme();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState('replace');
  const [importFormat, setImportFormat] = useState('json');
  const [songTitle, setSongTitle] = useState('Neuer Song');
  const [bpm, setBpm] = useState(90);
  const [feedback, setFeedback] = useState(null);
  const fileInputRef = useRef(null);

  const exportText = JSON.stringify(songs, null, 2);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  };

  const doDownload = () => {
    try {
      const blob = new Blob([JSON.stringify(songs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'autolyrics-songs.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback('Songs erfolgreich heruntergeladen');
      setTimeout(() => setFeedback(null), 2500);
    } catch (e) {
      alert('Download-Fehler: ' + e.message);
    }
  };

  const processImportString = (content, format) => {
    if (format === 'plaintext') {
      const parsedLines = parsePlaintextSongLines(content);
      if (!parsedLines.length) throw new Error('Keine gültigen Textzeilen gefunden');
      const newSong = {
        id: uid(),
        title: songTitle.trim() || 'Neuer Song',
        bpm: Number(bpm) || 90,
        timeSigNum: 4,
        timingMode: 'bar_beat',
        lines: parsedLines,
      };
      onImport(mode === 'replace' ? [newSong] : [...songs, newSong]);
      setText('');
      setFeedback('Klartext-Song erfolgreich importiert');
      setTimeout(() => setFeedback(null), 2500);
      return;
    }

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error('Erwartet ein Array von Songs (JSON-Liste)');
    const withIds = parsed.map((s) => ({
      ...s,
      id: s.id || uid(),
      lines: (s.lines || []).map((l) => ({ ...l, id: l.id || uid() })),
    }));
    onImport(mode === 'replace' ? withIds : [...songs, ...withIds]);
    setText('');
    setFeedback(`${withIds.length} Song(s) erfolgreich importiert`);
    setTimeout(() => setFeedback(null), 2500);
  };

  const doImport = () => {
    try {
      processImportString(text, importFormat);
    } catch (e) {
      alert('Import-Fehler: ' + e.message);
    }
  };

  const onFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      // If user uploaded a file, also set the text area
      setText(content);
      // Auto-detect format based on file name or content if JSON
      const isTxt = file.name.endsWith('.txt');
      const format = isTxt ? 'plaintext' : 'json';
      try {
        processImportString(content, format);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        // If auto-import fails, leave text in textarea for user to adjust/import manually
        alert('Fehler beim Importieren der Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3 pt-4 mt-4 border-t" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide font-bold" style={{ color: COLORS.inkDim }}>Import / Export</div>
        {feedback && (
          <div className="text-xs font-medium text-emerald-500 animate-pulse">{feedback}</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={doDownload}
          className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1 font-medium transition-colors border"
          style={{ background: COLORS.panelBg2, borderColor: COLORS.line, color: COLORS.ink }}
          title="Alle Songs als JSON-Datei herunterladen"
        >
          <Download size={13} /> Songs herunterladen (.json)
        </button>

        <button
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1 font-medium transition-colors border"
          style={{ background: COLORS.panelBg2, borderColor: COLORS.line, color: COLORS.ink }}
          title="Song-Datei (.json oder .txt) hochladen und importieren"
        >
          <Upload size={13} /> Song-Datei hochladen (.json / .txt)
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          onChange={onFile}
          className="hidden"
        />

        <button
          onClick={doCopy}
          className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1 border opacity-75 hover:opacity-100"
          style={{ background: COLORS.panelBg2, borderColor: COLORS.line, color: COLORS.inkDim }}
          title="In Zwischenablage kopieren"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} Als JSON kopieren
        </button>
      </div>

      <div className="flex gap-2 border-b pb-2 text-xs" style={{ borderColor: COLORS.line }}>
        <button
          onClick={() => setImportFormat('json')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            importFormat === 'json'
              ? 'bg-amber-500 text-black font-bold'
              : isDark
              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-700'
          }`}
        >
          JSON Text-Import
        </button>
        <button
          onClick={() => setImportFormat('plaintext')}
          className={`px-3 py-1 rounded-lg font-medium transition-colors ${
            importFormat === 'plaintext'
              ? 'bg-amber-500 text-black font-bold'
              : isDark
              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-700'
          }`}
        >
          Klartext Text-Import (.txt)
        </button>
      </div>

      {importFormat === 'plaintext' && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <input
            type="text"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            placeholder="Songtitel"
            className="px-2 py-1.5 rounded-lg border"
            style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
          />
          <div className="flex items-center gap-1">
            <span style={{ color: COLORS.inkDim }}>BPM:</span>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
              className="w-20 px-2 py-1.5 rounded-lg border"
              style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
            />
          </div>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={importFormat === 'plaintext' ? "Klartext hier einfügen...\nJede Zeile entspricht einem Takt.\n*Zeile für Nur-Stageview\n[Solo] Zeile mit Kommentar" : "JSON hier einfügen zum Importieren…"}
        rows={4}
        className="w-full text-xs rounded-lg p-2 font-mono border"
        style={{ background: COLORS.inputBg, borderColor: COLORS.line, color: COLORS.ink }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs flex items-center gap-1" style={{ color: COLORS.inkDim }}>
          <input type="radio" name="import_mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Ersetzen
        </label>
        <label className="text-xs flex items-center gap-1" style={{ color: COLORS.inkDim }}>
          <input type="radio" name="import_mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Hinzufügen
        </label>
        <button
          onClick={doImport}
          disabled={!text.trim()}
          className="text-xs px-3 py-1.5 rounded-full disabled:opacity-40 font-medium ml-auto"
          style={{ background: COLORS.amber, color: '#241a08' }}
        >
          Aus Textfeld importieren
        </button>
      </div>
    </div>
  );
}
