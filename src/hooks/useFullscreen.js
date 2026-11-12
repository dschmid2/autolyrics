import { useRef } from 'react';

// Ref for the element to show fullscreen and a function to request it
export function useFullscreen() {
  const ref = useRef(null);
  const requestFullscreen = () => {
    if (ref.current && ref.current.requestFullscreen) {
      ref.current.requestFullscreen().catch(() => {});
    }
  };
  return [ref, requestFullscreen];
}
