import { memo, useEffect, useRef } from 'react';

// Memoized: its props only change on zoom/song edits, not with the playhead
export const WaveformCanvas = memo(function WaveformCanvas({ audioBuffer, pxPerSec, bpm, timeSigNum, duration, width, height = 110, audioOffset = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = data.length;

    const secondsPerBeat = 60 / (bpm || 90);
    const secondsPerBar = secondsPerBeat * (timeSigNum || 4);
    const totalBars = Math.ceil(duration / secondsPerBar) + 1;

    for (let bar = 0; bar < totalBars; bar++) {
      const barTime = bar * secondsPerBar;
      const x = barTime * pxPerSec;
      if (x > width) break;

      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px monospace';
      ctx.fillText(`T${bar + 1}`, x + 3, 12);

      for (let beat = 1; beat < timeSigNum; beat++) {
        const beatTime = barTime + beat * secondsPerBeat;
        const bx = beatTime * pxPerSec;
        if (bx > width) break;
        ctx.strokeStyle = '#27272a';
        ctx.beginPath();
        ctx.moveTo(bx, 15);
        ctx.lineTo(bx, height);
        ctx.stroke();
      }
    }

    const centerY = height / 2;
    ctx.fillStyle = '#d89a3e';

    for (let x = 0; x < width; x++) {
      const songTime = x / pxPerSec;
      const audioTime = songTime - audioOffset;

      if (audioTime < 0 || audioTime >= audioBuffer.duration) {
        continue;
      }

      const startSample = Math.floor(audioTime * sampleRate);
      const endSample = Math.min(totalSamples, Math.floor((audioTime + 1 / pxPerSec) * sampleRate));

      if (startSample >= totalSamples || startSample < 0) continue;

      let min = 1.0;
      let max = -1.0;
      for (let i = startSample; i < endSample; i++) {
        const sample = data[i];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      if (min > max) {
        min = 0;
        max = 0;
      }

      const top = centerY - max * (height / 2.2);
      const bottom = centerY - min * (height / 2.2);
      const barHeight = Math.max(1, bottom - top);

      ctx.fillRect(x, top, 1, barHeight);
    }
  }, [audioBuffer, pxPerSec, bpm, timeSigNum, duration, width, height, audioOffset]);

  return <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px`, display: 'block' }} />;
});
