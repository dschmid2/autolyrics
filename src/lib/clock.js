// anchorEpoch is always expressed in *server* time. Every client estimates the
// offset between its own clock and the server clock (NTP-style, via ping/pong
// round trips), so devices with skewed clocks still agree on the playback
// position. Without this, a stage device whose clock runs slightly behind the
// operator device briefly shows the previous line after a jump.
let serverClockOffset = 0; // serverTime - localTime in ms

let clockSamples = [];

const MAX_CLOCK_SAMPLES = 8;

export function serverNow() {
  return Date.now() + serverClockOffset;
}

export function recordClockSample(t0, serverTime) {
  const t1 = Date.now();
  const rtt = t1 - Number(t0);
  if (!Number.isFinite(rtt) || rtt < 0 || rtt > 10000 || !Number.isFinite(Number(serverTime))) return;
  clockSamples.push({ rtt, offset: Number(serverTime) + rtt / 2 - t1 });
  if (clockSamples.length > MAX_CLOCK_SAMPLES) clockSamples.shift();
  // The sample with the smallest round trip has the smallest error bound
  const best = clockSamples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
  serverClockOffset = best.offset;
}

// Forget all samples (called on every new connection)
export function resetClockSync() {
  clockSamples = [];
}

// Rough first estimate from the server's `state` message, used until the
// first ping/pong round trip arrives
export function setInitialClockOffset(serverTime) {
  if (clockSamples.length === 0) serverClockOffset = serverTime - Date.now();
}
