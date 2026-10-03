/**
 * Trust layer: text redaction before anything is stored.
 * A conservative regex pass plus personal names explicitly supplied by the caller, not NER.
 */

export interface Redaction {
  text: string;
  entities: { kind: string; original: string }[];
}

const phoneSeparator = String.raw`[ \t\u00a0\u202f-]`;
const subscriber = String.raw`(?:\d{5,9}|\d{3}${phoneSeparator}\d{4}|\d{4}${phoneSeparator}\d{4})`;
const PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "iban", re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g },
  { kind: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { kind: "vat_id", re: /\b(?:DE|CZ|AT|FR|NL)\s?\d{8,11}\b/g },
  { kind: "tax_number", re: /\b\d{2,3}\/\d{3}\/\d{4,5}\b/g },
  { kind: "phone", re: new RegExp(String.raw`(?<![\w+])(?:\+\d{1,3}${phoneSeparator}(?:\(\d{1,5}\)|\d{1,5})${phoneSeparator}${subscriber}|(?:\(\d{2,5}\)${phoneSeparator}?|0\d{1,4}${phoneSeparator})${subscriber}|\d{3}${phoneSeparator}\d{3}${phoneSeparator}\d{4}|\+\d{8,15}|0\d{7,14})\b`, "g") },
  { kind: "card", re: /(?<![\w+])(?<!\d-)(?:\d{13,19}|\d{4}[ -]\d{6}[ -]\d{5}|\d{4}(?:[ -]\d{4}){2}[ -]\d{1,4}(?:[ -]\d{3})?)\b/g },
];

/** Supply full personal names (at least three characters), not initials or company/role labels. */
export function redactText(text: string, personalNames: string[] = []): Redaction {
  const entities: Redaction["entities"] = [];
  let out = text;
  for (const { kind, re } of PATTERNS) {
    out = out.replace(re, (m) => {
      const digits = m.replace(/\D/g, "");
      if (kind === "phone" && (digits.length < 8 || digits.length > 15 || /^\d{4}(?:[ \t\u00a0\u202f-]\d{4})+$/.test(m))) return m;
      let suffix = "";
      if (kind === "card" && !validCard(digits)) {
        const prefix = m.replace(/[ -]\d{3}$/, "");
        if (prefix === m || !validCard(prefix.replace(/\D/g, ""))) return m;
        suffix = m.slice(prefix.length);
        m = prefix;
      }
      entities.push({ kind, original: m });
      return `[${kind}]${suffix}`;
    });
  }
  for (const name of personalNames.map((name) => name.trim()).filter((name) => name.length >= 3).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(name)}(?![\\p{L}\\p{N}_])`, "giu");
    out = out.replace(re, (original) => { entities.push({ kind: "person", original }); return "[person]"; });
  }
  return { text: out, entities };
}

function validCard(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if ((digits.length - 1 - i) % 2) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return !/^0+$/.test(digits) && sum % 10 === 0;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface PiiRegion {
  x: number; // normalized 0..1
  y: number;
  w: number;
  h: number;
  kind: string;
}

/**
 * Blur regions on a canvas before a frame is stored. Browser only.
 * Uses a pixelate approach (draw small, scale up) so it works without CSS filters.
 */
export function blurRegions(canvas: HTMLCanvasElement, regions: PiiRegion[]): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  let n = 0;
  for (const r of regions) {
    const x = Math.floor(r.x * canvas.width), y = Math.floor(r.y * canvas.height);
    const w = Math.max(4, Math.floor(r.w * canvas.width)), h = Math.max(4, Math.floor(r.h * canvas.height));
    const tmp = document.createElement("canvas");
    tmp.width = Math.max(1, Math.floor(w / 12));
    tmp.height = Math.max(1, Math.floor(h / 12));
    const tctx = tmp.getContext("2d");
    if (!tctx) continue;
    tctx.drawImage(canvas, x, y, w, h, 0, 0, tmp.width, tmp.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = "rgba(245,166,35,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    n++;
  }
  return n;
}
