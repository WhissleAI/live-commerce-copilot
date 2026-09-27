import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contrast, oklchToSrgb, parseOklch } from "./contrast";

const css = readFileSync("src/styles.css", "utf8");

/** A token's authored value, read from the stylesheet rather than restated. */
function token(name: string): string {
  const m = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"));
  if (!m) throw new Error(`--${name} is not defined in styles.css`);
  return m[1]!.trim();
}
const rgb = (name: string) => {
  const c = parseOklch(token(name));
  if (!c) throw new Error(`--${name} is not an oklch() value: ${token(name)}`);
  return c;
};

// ── the converter is only trustworthy because it was checked ────────────────
//
// These figures were measured in Chrome, by painting each token to a canvas and
// reading the pixel back, on the deployed build. If this block ever fails the
// converter is wrong and every assertion below it is worthless.
describe("the oklch converter agrees with a real renderer", () => {
  it("reproduces contrast figures measured in the browser", () => {
    const faintBefore = oklchToSrgb(0.5655, 0.0158, 261.3);
    expect(contrast(faintBefore, rgb("canvas"))).toBe(4.29);
    expect(contrast(faintBefore, rgb("panel"))).toBe(4.56);
    expect(contrast(faintBefore, rgb("elevated"))).toBe(4.17);
  });

  it("reproduces the textbook pairs", () => {
    const black: [number, number, number] = [0, 0, 0];
    const white: [number, number, number] = [255, 255, 255];
    expect(contrast(black, white)).toBe(21);
    expect(contrast(white, white)).toBe(1);
    // #767676 on white is the canonical 4.5 boundary.
    expect(contrast([118, 118, 118], white)).toBe(4.54);
  });
});

// ── the rule ────────────────────────────────────────────────────────────────

const SURFACES = ["canvas", "panel", "elevated"] as const;
const TEXT = ["text-primary", "text-secondary", "text-muted", "text-faint"] as const;
const AA = 4.5;

describe("every text token clears AA on every surface it can sit on", () => {
  for (const t of TEXT) {
    for (const s of SURFACES) {
      it(`--${t} on --${s}`, () => {
        expect(contrast(rgb(t), rgb(s))).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  // The point of having two muted tokens is that one is lighter. Fixing
  // contrast by collapsing them would pass the rule above and lose the reason
  // the token exists.
  it("keeps --text-faint lighter than --text-muted", () => {
    expect(contrast(rgb("text-faint"), rgb("canvas"))).toBeLessThan(
      contrast(rgb("text-muted"), rgb("canvas")),
    );
  });
});
