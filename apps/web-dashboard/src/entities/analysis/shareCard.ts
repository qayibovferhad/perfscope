import { RATING_COLOR, rateScore, rateVital, type AnalysisResult } from '@perfscope/shared';
import { fmtMs } from '@/shared/lib/format';

/**
 * A result, drawn as one image worth pasting into a pull request.
 *
 * A share link needs an account to open and a JSON file needs a reader; what people
 * actually do with an audit is show it to someone, in Slack or on a PR, where an image is
 * the only attachment that renders itself. So the card is the summary — four scores and
 * three vitals — and nothing else. A screenshot of the whole page is unreadable at the
 * size a chat client shows it.
 *
 * Canvas rather than a DOM-to-image dependency: this is seven numbers and two rows of
 * text, and the libraries that rasterise arbitrary DOM bring their own font and CSS
 * fidelity problems for a layout we control completely anyway.
 */

/** Open Graph's 1.91:1, so it renders as a card in Slack and on a PR, not a thumbnail. */
const W = 1200;
const H = 630;

/** Drawn at 2× and scaled down, so it stays sharp on the displays people read chat on. */
const SCALE = 2;

const BG    = '#04130d';
const PANEL = '#0a1f16';
const TEXT  = '#eafff5';
const MUTED = '#7d9a8d';
const SANS  = "'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO  = "'Geist Mono', ui-monospace, 'SF Mono', monospace";

const CATEGORIES = [
  { key: 'performance',   label: 'Performance'   },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'bestPractices', label: 'Best Practices' },
  { key: 'seo',           label: 'SEO'           },
] as const;

/** A score ring: the arc is the score, the colour is the band it falls in. */
function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, score: number) {
  const color = RATING_COLOR[rateScore(score)];

  ctx.lineWidth = 11;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // From twelve o'clock, clockwise — the direction every score dial in the app turns.
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * score) / 100);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = `700 ${Math.round(r * 0.86)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.round(score)), cx, cy + 1);
}

/** Trimmed to fit rather than overflowing — a long URL must not push the date off the card. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export function drawShareCard(result: AnalysisResult): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width  = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // One wash of the accent, so the card reads as this product's rather than as a generic
  // dark rectangle with numbers on it.
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0, 'rgba(20,192,138,0.16)');
  wash.addColorStop(0.55, 'rgba(20,192,138,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // ── Header ────────────────────────────────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#14c08a';
  ctx.font = `800 21px ${SANS}`;
  ctx.fillText('PerfScope', 64, 84);

  ctx.fillStyle = MUTED;
  ctx.font = `600 15px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText([
    new Date(result.timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    result.formFactor === 'mobile' ? 'Mobile' : 'Desktop',
  ].join('  ·  '), W - 64, 84);

  let host = result.url;
  try {
    const parsed = new URL(result.url);
    host = parsed.host + parsed.pathname.replace(/\/$/, '');
  } catch { /* an unparseable URL is still worth printing raw */ }

  ctx.textAlign = 'left';
  ctx.fillStyle = TEXT;
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText(ellipsize(ctx, host, W - 128), 64, 146);

  // ── Score rings ───────────────────────────────────────────────────────────
  const ringY = 268;
  const step = (W - 128) / CATEGORIES.length;
  CATEGORIES.forEach((category, i) => {
    const cx = 64 + step * i + step / 2;
    ring(ctx, cx, ringY, 58, result.scores[category.key]);
    ctx.fillStyle = MUTED;
    ctx.font = `600 17px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(category.label, cx, ringY + 96);
  });

  // ── Vitals ────────────────────────────────────────────────────────────────
  const vitals = [
    { key: 'lcp' as const, label: 'LCP', value: result.metrics.lcp, text: fmtMs(result.metrics.lcp) },
    { key: 'tbt' as const, label: 'TBT', value: result.metrics.tbt, text: fmtMs(result.metrics.tbt) },
    { key: 'cls' as const, label: 'CLS', value: result.metrics.cls, text: result.metrics.cls.toFixed(3) },
  ];

  const boxY = 424;
  const boxH = 118;
  const gap  = 20;
  const boxW = (W - 128 - gap * (vitals.length - 1)) / vitals.length;

  vitals.forEach((vital, i) => {
    const x = 64 + (boxW + gap) * i;
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.roundRect(x, boxY, boxW, boxH, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `700 13px ${MONO}`;
    ctx.fillText(vital.label, x + 26, boxY + 40);

    ctx.fillStyle = RATING_COLOR[rateVital(vital.key, vital.value)];
    ctx.font = `700 42px ${SANS}`;
    ctx.fillText(vital.text, x + 26, boxY + 90);
  });

  ctx.fillStyle = MUTED;
  ctx.font = `500 14px ${MONO}`;
  ctx.fillText('Measured with Lighthouse', 64, H - 34);

  return canvas;
}

/** The card as a PNG. Rejects only if the browser refuses to encode it. */
export function shareCardBlob(result: AnalysisResult): Promise<Blob> {
  return new Promise((resolve, reject) => {
    drawShareCard(result).toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not render the image')),
      'image/png',
    );
  });
}

/** `perfscope-example.com-2026-08-23.png` — sortable, and obvious in a downloads folder. */
export function shareCardFilename(result: AnalysisResult): string {
  let host = 'audit';
  try { host = new URL(result.url).host; } catch { /* keep the fallback */ }
  return `perfscope-${host}-${result.timestamp.slice(0, 10)}.png`;
}
