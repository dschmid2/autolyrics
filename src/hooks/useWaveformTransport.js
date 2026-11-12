import { useState, useEffect, useRef, useCallback } from 'react';
import { withAnchor } from '../lib/playback';

// Local playback of the waveform editor: play/pause/stop/seek on the song
// timeline, keeps the <audio> element (shifted by audioOffset) in sync, scrolls
// the waveform with the playhead and optionally mirrors the position to the
// live displays ("send to screens").
export function useWaveformTransport({
  song, audioRef, containerRef, audioBuffer, audioDuration, audioOffset,
  totalDuration, pxPerSec, isDragging, playback, sendPlayback, seekRef,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  const [sendToScreens, setSendToScreens] = useState(false);
  const sendToScreensRef = useRef(false);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    let animId;
    const update = () => {
      if (!isPlayingRef.current) return;
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      setCurrentTime((prev) => {
        if (!isPlayingRef.current) return prev;
        const nextSongTime = Math.max(0, prev + delta);
        const targetAudioTime = nextSongTime - audioOffset;

        if (audioRef.current && audioBuffer) {
          if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
            if (audioRef.current.paused && isPlayingRef.current) {
              audioRef.current.currentTime = targetAudioTime;
              audioRef.current.play().catch(() => {});
            } else if (!audioRef.current.paused) {
              const diff = Math.abs(audioRef.current.currentTime - targetAudioTime);
              if (diff > 0.15) {
                audioRef.current.currentTime = targetAudioTime;
              }
            }
          } else {
            if (!audioRef.current.paused) {
              audioRef.current.pause();
            }
          }
        }

        if (containerRef.current && !isDragging) {
          const container = containerRef.current;
          const headX = nextSongTime * pxPerSec;
          const targetScrollLeft = headX - container.clientWidth / 2;
          container.scrollLeft = Math.max(0, targetScrollLeft);
        }

        currentTimeRef.current = nextSongTime;
        return nextSongTime;
      });

      if (isPlayingRef.current) {
        animId = requestAnimationFrame(update);
      }
    };

    if (isPlaying) {
      lastTickRef.current = Date.now();
      animId = requestAnimationFrame(update);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, audioOffset, audioBuffer, audioDuration, isDragging, pxPerSec]);

  // Keep latest refs for callbacks to avoid stale closures
  const playbackRef = useRef(playback);
  useEffect(() => { playbackRef.current = playback; }, [playback]);
  const songRef = useRef(song);
  useEffect(() => { songRef.current = song; }, [song]);

  const syncScreens = useCallback((status, timeSec) => {
    if (!sendToScreensRef.current || !sendPlayback) return;
    const elapsed = timeSec !== undefined ? timeSec : currentTimeRef.current;
    sendPlayback(withAnchor(playbackRef.current || {}, {
      songId: songRef.current.id,
      status,
      anchorElapsed: Math.max(0, elapsed),
    }));
  }, [sendPlayback]);

  useEffect(() => {
    return () => {
      // If sendToScreens was active when component unmounts, stop screens
      if (sendToScreensRef.current && sendPlayback && playbackRef.current) {
        sendPlayback(withAnchor(playbackRef.current, {
          songId: songRef.current.id,
          status: 'stopped',
          anchorElapsed: 0,
        }));
      }
    };
  }, [sendPlayback]);

  const toggleSendToScreens = () => {
    const nextVal = !sendToScreens;
    setSendToScreens(nextVal);
    sendToScreensRef.current = nextVal;
    if (sendPlayback) {
      if (nextVal) {
        syncScreens(isPlayingRef.current ? 'playing' : 'paused', currentTimeRef.current);
      } else {
        sendPlayback(withAnchor(playbackRef.current || {}, {
          songId: songRef.current.id,
          status: 'stopped',
          anchorElapsed: 0,
        }));
      }
    }
  };

  const togglePlay = () => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      syncScreens('paused', currentTimeRef.current);
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      const targetAudioTime = currentTime - audioOffset;
      if (audioRef.current && audioBuffer && targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        audioRef.current.currentTime = targetAudioTime;
        audioRef.current.play().catch(() => {});
      }
      syncScreens('playing', currentTimeRef.current);
    }
  };

  const stop = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
    setCurrentTime(0);
    currentTimeRef.current = 0;
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
    syncScreens('stopped', 0);
  };

  const seekToTime = useCallback((timeSec) => {
    const clampedTime = Math.max(0, Math.min(totalDuration, timeSec));
    setCurrentTime(clampedTime);
    currentTimeRef.current = clampedTime;
    const targetAudioTime = clampedTime - audioOffset;
    if (audioRef.current && audioBuffer) {
      if (targetAudioTime >= 0 && targetAudioTime <= audioDuration) {
        audioRef.current.currentTime = targetAudioTime;
      } else {
        audioRef.current.pause();
      }
    }
    if (containerRef.current) {
      const container = containerRef.current;
      const headX = clampedTime * pxPerSec;
      container.scrollLeft = Math.max(0, headX - container.clientWidth / 2);
    }
    syncScreens(isPlayingRef.current ? 'playing' : 'paused', clampedTime);
  }, [totalDuration, audioOffset, audioBuffer, audioDuration, pxPerSec, syncScreens]);

  // Lets the parent (line list) jump to a marker
  useEffect(() => {
    if (seekRef) {
      seekRef.current = seekToTime;
    }
  }, [seekRef, seekToTime]);

  const nudge = (delta) => {
    seekToTime(currentTime + delta);
  };

  // <audio onEnded>
  const handleAudioEnded = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    syncScreens('stopped', 0);
  };

  return { isPlaying, currentTime, sendToScreens, togglePlay, stop, seekToTime, nudge, toggleSendToScreens, handleAudioEnded };
}
