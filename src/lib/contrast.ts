// oklch → sRGB → WCAG contrast, with no browser.
//
// The design tokens are authored in oklch, which is the right space to pick
// colours in and the wrong one to reason about legibility in: two tokens a
// tenth apart in L can land either side of the 4.5 line depending on the
// surface behind them. A previous pass darkened `--text-faint` by eye, wrote
// down the numbers it was aiming for, and stopped two steps short of them.
//
// The conversion below is the standard oklab pipeline, and it is validated in
// `contrast.spec.ts` against figures measured in the browser's own renderer —
// which is the only reason it is allowed to be the thing that guards the
// stylesheet.

export type Rgb = [number, number, number];

export function oklchToSrgb(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.089484177 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const enc = (u: number): number => {
    const v = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  };
  return [enc(lr), enc(lg), enc(lb)];
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const f = (v: number): number => {
    const u = v / 255;
    return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)).toFixed(2));
}

/** `oklch(L C H)` as written in the stylesheet. Returns null for any other
 *  notation, so a token in a different space is reported rather than guessed. */
export function parseOklch(value: string): Rgb | null {
  const m = value.trim().match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  return m ? oklchToSrgb(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}
