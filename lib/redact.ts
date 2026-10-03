/**
 * Trust layer: text redaction before anything is stored.
 * A TypeScript regex pass (honest and visible). Swap in a Presidio sidecar via REDACT_URL if you want NER.
 */

export interface Redaction {
  text: string;
  entities: { kind: string; original: string }[];
}

const PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "iban", re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g },
  { kind: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  { kind: "phone", re: /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)\d{3,4}[\s-]?\d{3,5}\b/g },
  { kind: "vat_id", re: /\b(?:DE|CZ|AT|FR|NL)\s?\d{8,11}\b/g },
  { kind: "tax_number", re: /\b\d{2,3}\/\d{3}\/\d{4,5}\b/g },
  { kind: "card", re: /\b(?:\d[ -]?){13,19}\b/g },
];

/** Names the vision model flagged as personal (not supplier companies) get masked too. */
export function redactText(text: string, personalNames: string[] = []): Redaction {
  const entities: Redaction["entities"] = [];
  let out = text;
  for (const { kind, re } of PATTERNS) {
    out = out.replace(re, (m) => {
      // skip plain amounts like 7 850 or invoice numbers of 4 digits
      if (kind === "phone" && /^\d{4,5}$/.test(m.replace(/\s/g, ""))) return m;
      if (kind === "card" && m.replace(/\D/g, "").length < 13) return m;
      entities.push({ kind, original: m });
      return `[${kind}]`;
    });
  }
  for (const name of personalNames) {
    if (!name || name.length < 3) continue;
    const re = new RegExp(`\\b${escapeRe(name)}\\b`, "gi");
    if (re.test(out)) {
      entities.push({ kind: "person", original: name });
      out = out.replace(re, "[person]");
    }
  }
  return { text: out, entities };
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
