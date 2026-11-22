/**
 * Rough text metrics for laying out labels at build time, when no fonts are measured.
 * Widths are in pixels for Source Sans 3 and Noto Sans SC at the given size.
 */

const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/;

export function isCjk(text: string): boolean {
  return CJK.test(text);
}

function charWidth(ch: string): number {
  if (CJK.test(ch)) return 1;
  if (/[A-Z]/.test(ch)) return /[MW]/.test(ch) ? 0.82 : 0.62;
  if (/[ilIj.,:;!'|]/.test(ch)) return 0.27;
  if (ch === ' ') return 0.25;
  if (/[mw]/.test(ch)) return 0.8;
  if (/[0-9]/.test(ch)) return 0.52;
  return 0.5;
}

export function textWidth(text: string, size: number): number {
  let width = 0;
  for (const ch of text) width += charWidth(ch);
  return width * size;
}

const BREAK_AFTER = /[，、？：；。！\s]/;

/** Breaks text into lines no wider than `maxWidth`; Chinese breaks between characters. */
export function wrapText(text: string, size: number, maxWidth: number): string[] {
  if (textWidth(text, size) <= maxWidth) return [text];
  const lines: string[] = [];
  if (isCjk(text)) {
    let line = '';
    for (const ch of text) {
      if (line && textWidth(line + ch, size) > maxWidth && !/[，、？：；。！）]/.test(ch)) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
    if (line) lines.push(line);
    return balance(lines, size);
  }
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Evens out Chinese lines so a short last line does not dangle. */
function balance(lines: string[], size: number): string[] {
  if (lines.length < 2) return lines;
  const chars = [...lines.join('')];
  const per = Math.ceil(chars.length / lines.length);
  const out: string[] = [];
  for (let i = 0; i < chars.length;) {
    let end = Math.min(chars.length, i + per);
    if (end < chars.length && /[，、？：；。！）]/.test(chars[end])) end++;
    else if (!BREAK_AFTER.test(chars[end - 1] ?? '')) {
      for (let k = 1; k <= 2; k++) {
        if (BREAK_AFTER.test(chars[end - 1 - k] ?? '')) {
          end -= k;
          break;
        }
      }
    }
    out.push(chars.slice(i, end).join(''));
    i = end;
  }
  return out.filter((l) => textWidth(l, size) > 0);
}
