import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The audio bridge was unreachable on a narrow window.
 *
 * `TranscriptPanel` owns the "Open bridge" button, and it renders only inside
 * the left rail — which is `hidden` below xl (2xl when the cost column is
 * out). Below that the chat folds into a sheet that carries `ChatColumn` and
 * nothing else, so the panel was not rendered anywhere and there was no way to
 * start host audio from any part of the product.
 *
 * Reported from a live eBay Live session: chat and proposals on screen, no
 * host audio, no control to ask for it.
 *
 * The bar is the one row that survives every width, and host audio is a
 * session-level action like Watch and End session already sitting in it.
 */
const consoleSrc = readFileSync(join(import.meta.dirname, "Console.tsx"), "utf8");
const topBar = readFileSync(join(import.meta.dirname, "TopBar.tsx"), "utf8");

describe("the audio bridge is reachable at every width", () => {
  it("the bar can open it", () => {
    expect(topBar).toMatch(/onOpenBridge/);
    expect(topBar).toMatch(/Host audio/);
  });

  it("one handler serves both places, so they cannot drift", () => {
    // Two copies of the open-then-toast logic would eventually disagree about
    // what a blocked pop-up says.
    expect(consoleSrc.match(/openAudioBridge\(/g) ?? []).toHaveLength(1);
  });

  it("the bar's copy hides where the panel already carries it", () => {
    // Two buttons for one action at wide widths is worse than none.
    expect(consoleSrc).toMatch(/bridgeClassName: sidePanel \? "2xl:hidden" : "xl:hidden"/);
  });

  it("is offered only where the surface has host audio at all", () => {
    // Whatnot and TikTok Live are scraped through a browser; there is no audio
    // to bridge, and a button promising some would be a lie.
    expect(consoleSrc).toMatch(/openBridge && layout\.hostAudio/);
  });

  it("does nothing in mock mode, where there is no session to bridge", () => {
    expect(consoleSrc).toMatch(/USE_MOCKS\s*\n?\s*\?\s*null/);
  });
});
