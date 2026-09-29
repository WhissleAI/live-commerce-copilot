import { describe, expect, it } from "vitest";
import { frontDoor } from "./front-door";

describe("what / renders", () => {
  it("shows the landing page before the session is known", () => {
    // CONTENT-14's ratchet. This is the case that server-renders, and the one
    // every non-JS client sees: a crawler, an unfurler, an AI answer engine.
    // Returning nothing here is how the marketing copy became invisible to all
    // of them while looking correct in a browser.
    expect(frontDoor("unknown")).toBe("landing");
  });

  it("shows the landing page to a visitor", () => {
    expect(frontDoor("out")).toBe("landing");
  });

  it("shows Home to a seller", () => {
    expect(frontDoor("in")).toBe("home");
  });
});
