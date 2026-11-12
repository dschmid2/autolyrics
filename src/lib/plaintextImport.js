import { uid } from './ids';

export function parsePlaintextSongLines(plaintext) {
  if (!plaintext) return [];
  const rawLines = plaintext.split(/\r?\n/);
  const lines = [];
  let barIndex = 1;

  for (let i = 0; i < rawLines.length; i++) {
    let lineStr = rawLines[i].trim();
    if (!lineStr) continue;

    let stageOnly = false;
    if (lineStr.startsWith('*')) {
      stageOnly = true;
      lineStr = lineStr.slice(1).trim();
    }

    let comment = '';
    const bracketMatch = lineStr.match(/^\[(.*?)\]\s*(.*)$/);
    if (bracketMatch) {
      comment = bracketMatch[1].trim();
      lineStr = bracketMatch[2].trim();
    }

    if (!stageOnly && lineStr.startsWith('*')) {
      stageOnly = true;
      lineStr = lineStr.slice(1).trim();
    }

    lines.push({
      id: uid(),
      en: lineStr,
      de: '',
      mode: 'bar_beat',
      bar: barIndex,
      beat: 1,
      duration: '',
      stageOnly,
      comment,
    });
    barIndex++;
  }
  return lines;
}
