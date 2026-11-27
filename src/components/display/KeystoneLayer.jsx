import { useEffect, useState } from 'react';
import { keystoneMatrix3d } from '../../../shared/keystone';

function useWindowSize() {
  const read = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const onResize = () => setSize(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

// Test pattern for adjusting the corners: border, 10 % grid, centre cross and
// a circle that must look round on the screen once the correction is right.
function KeystoneGrid() {
  const lines = [];
  for (let i = 1; i < 10; i++) {
    // vector-effect is not inherited from <g>: set it on every line
    lines.push(<line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" vectorEffect="non-scaling-stroke" />);
    lines.push(<line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} vectorEffect="non-scaling-stroke" />);
  }
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 40 }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <g stroke="#F4EFE4" strokeOpacity="0.35" strokeWidth="1">{lines}</g>
        <g stroke="#D89A3E" strokeWidth="3" fill="none" vectorEffect="non-scaling-stroke">
          <rect x="0" y="0" width="100" height="100" vectorEffect="non-scaling-stroke" />
          <line x1="50" y1="40" x2="50" y2="60" vectorEffect="non-scaling-stroke" />
          <line x1="40" y1="50" x2="60" y2="50" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#D89A3E" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

// Warps its children (a full-screen view) onto the quadrilateral set in the
// player's keystone settings. Only mounted when the correction is enabled, so
// a display without it renders and computes exactly as before.
export function KeystoneLayer({ keystone, fullscreenRef, children }) {
  const { width, height } = useWindowSize();
  return (
    <div ref={fullscreenRef} className="fixed inset-0 overflow-hidden" style={{ background: '#000' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${width}px`,
          height: `${height}px`,
          transformOrigin: '0 0',
          transform: keystoneMatrix3d(keystone.corners, width, height),
        }}
      >
        {children}
        {keystone.showGrid && <KeystoneGrid />}
      </div>
    </div>
  );
}
