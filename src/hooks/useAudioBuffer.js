import { useState, useEffect } from 'react';

export function useAudioBuffer(audioUrl) {
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!audioUrl) {
      setAudioBuffer(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(audioUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Audio konnte nicht geladen werden');
        return res.arrayBuffer();
      })
      .then((arrayBuffer) => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        return ctx.decodeAudioData(arrayBuffer);
      })
      .then((buffer) => {
        if (!cancelled) {
          setAudioBuffer(buffer);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Fehler beim Dekodieren');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  return { audioBuffer, loading, error };
}
