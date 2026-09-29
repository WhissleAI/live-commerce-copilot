import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  absoluteUrl,
  SITE_IMAGE,
  SITE_IMAGE_HEIGHT,
  SITE_IMAGE_PATH,
  SITE_IMAGE_WIDTH,
  SITE_ORIGIN,
  siteMeta,
} from "./meta";

/**
 * CONTENT-13's ratchet.
 *
 * A share card is the one part of this product that is never rendered by our
 * own code: Slack, LinkedIn, iMessage, WhatsApp and X read these tags and draw
 * the card themselves, so a mistake here is invisible in every test, every
 * screenshot and every browser — and shows up only as a colleague pasting the
 * link and getting a grey box. A relative `og:image` is exactly that mistake,
 * and it survived a round of work that was specifically about the image.
 */
describe("the tags an unfurler reads", () => {
  /** Anything whose value is a location, by the tag's own name. */
  const locationish = (key: string) => /(?:^|:)(?:image|url|video|audio)$/.test(key);

  it("names every location absolutely", () => {
    const tags = siteMeta("/");
    const located = tags.filter((t) => locationish(t.property ?? t.name ?? ""));
    // If this is 0 the filter stopped matching, not the tags stopped existing.
    expect(located.length).toBeGreaterThanOrEqual(3);
    for (const t of located) {
      expect(t.content, `${t.property ?? t.name} must be absolute`).toMatch(/^https:\/\//);
    }
  });

  it("points og:url at the page it was asked about, not at the origin", () => {
    const url = siteMeta("/console").find((t) => t.property === "og:url");
    expect(url?.content).toBe(`${SITE_ORIGIN}/console`);
  });

  it("omits og:url when the caller does not know its own path", () => {
    // The root head runs on every route. A blanket og:url there would tell a
    // crawler that /console and /reports are both the front door.
    expect(siteMeta().some((t) => t.property === "og:url")).toBe(false);
  });

  it("declares the dimensions the shipped file actually has", () => {
    const jpeg = readFileSync(join(process.cwd(), "public", SITE_IMAGE_PATH));
    expect(sizeOfJpeg(jpeg)).toEqual({ width: SITE_IMAGE_WIDTH, height: SITE_IMAGE_HEIGHT });
  });

  it("serves the image from the same origin it builds every other URL from", () => {
    expect(SITE_IMAGE).toBe(absoluteUrl(SITE_IMAGE_PATH));
    expect(SITE_ORIGIN.endsWith("/")).toBe(false);
  });
});

/** Walks the JPEG's segments to the frame header. Enough for a size check. */
function sizeOfJpeg(d: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < d.length) {
    if (d[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = d[i + 1]!;
    // SOF0..SOF15, minus the three that are not frame headers (DHT, JPG, DAC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: d.readUInt16BE(i + 5), width: d.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    i += 2 + d.readUInt16BE(i + 2);
  }
  throw new Error("no frame header in the shipped share image");
}
