/**
 * The mock is a stand-in for the server, and a stand-in that is LOOSER than
 * the thing it stands in for teaches the console a behaviour production will
 * refuse. Both of these are behaviours `Pipeline.send` has (backend
 * `src/pipeline/pipeline.ts`) and the mock did not.
 */

import { describe, expect, it } from "vitest";
import { MockDriver } from "./mockStream";
import { deliveryOf } from "./surfaces";

const held = (d: MockDriver) => d.proposals.find((p) => p.status === "blocked")!;

describe("the mock refuses what the server refuses", () => {
  it("will not send a held reply unedited, and names the guard that held it", async () => {
    const d = new MockDriver();
    const p = held(d);
    await expect(d.sendProposal(p.id)).rejects.toThrow(/blocked and cannot be sent unedited/);
    await expect(d.sendProposal(p.id)).rejects.toThrow(/price:/);
    expect(d.proposals.find((x) => x.id === p.id)?.status).toBe("blocked");
  });

  /** Re-submitting the same text is not an edit, whatever the client calls it. */
  it("treats text identical to the draft as unedited", async () => {
    const d = new MockDriver();
    const p = held(d);
    await expect(d.sendProposal(p.id, `  ${p.draft}  `)).rejects.toThrow(/cannot be sent unedited/);
  });

  /** An edit is a NEW draft, judged on its own words rather than on the
   *  verdict the text it replaced earned. */
  it("accepts the same reply once the operator has rewritten it", async () => {
    const d = new MockDriver();
    const p = held(d);
    const next = await d.sendProposal(p.id, "I can't go that low tonight — the listing stands.");
    expect(next.status).toBe("sent");
    expect(next.sentText).toBe("I can't go that low tonight — the listing stands.");
  });
});

describe("what the mock says happens to an accepted reply", () => {
  it("hands it to the operator, because nothing in this build delivers", async () => {
    const d = new MockDriver();
    const ready = d.proposals.find((p) => p.status === "ready")!;
    expect(deliveryOf(ready)).toBe("human");
    const next = await d.sendProposal(ready.id);
    expect(deliveryOf(next)).toBe("human");
    expect(d.audit.at(-1)?.summary).toMatch(/approved and recorded/);
    expect(d.audit.at(-1)?.summary).not.toMatch(/sent to/);
  });
});
