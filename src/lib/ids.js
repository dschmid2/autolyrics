export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function generateGuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreatePlayerId() {
  try {
    let id = localStorage.getItem('autolyrics_player_id');
    if (!id) {
      id = generateGuid();
      localStorage.setItem('autolyrics_player_id', id);
    }
    return id;
  } catch (e) {
    return generateGuid();
  }
}
