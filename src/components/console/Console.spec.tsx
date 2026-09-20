/**
 * What the console renders, per surface.
 *
 * The console itself lives inside the shell, the router and a live SSE
 * subscription, so the thing worth testing is not "does <Console/> mount" — it
 * is the two halves that decide its shape: `consoleLayout`, which says which
 * columns exist, and the columns themselves, which take that decision as a
 * prop. Both are driven here with the real capability table.
 *
 * The first block is a regression test for the reference surface. eBay Live is
 * the submission demo and every change in this wave was supposed to be
 * additive; if a column it has today stops rendering, that is the failure this
 * file exists to catch.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SURFACE_CAPABILITIES, consoleLayout, guardOrderFor } from "@/lib/surfaces";
import { GUARD_LABEL } from "@/lib/format";
import type { Listing, ReplyProposal } from "@/lib/types";
import { ShowRail } from "./ShowRail";
import { ProposalQueue } from "./ProposalQueue";

const listing: Listing = {
  id: "lst_1",
  sku: "AJ1-CHI",
  title: "Air Jordan 1 Chicago Reimagined",
  brand: "Nike",
  model: "AJ1",
  colorway: "Chicago",
  size: "10",
  condition: "DS",
  priceCents: 42000,
  floorPriceCents: 38000,
  costCents: 30000,
  qty: 1,
  soldThisShow: 0,
  views: 12,
  state: "live",
  pinned: true,
  version: 3,
  imageUrl: "",
  shippingProfile: "standard",
  authenticated: true,
  certId: null,
  updatedAt: "2026-09-18T10:00:00.000Z",
};

function proposal(over: Partial<ReplyProposal> = {}): ReplyProposal {
  return {
    id: "p_1",
    message: {
      id: "m_1",
      author: "buyer42",
      text: "is the size 10 still there?",
      at: "2026-09-18T10:00:00.000Z",
      intent: "availability",
      admitted: true,
    },
    status: "ready",
    draft: "Yes — one pair left in a 10.",
    claims: [],
    evidence: [
      {
        factId: "listing:lst_1#qty",
        source: "listing",
        corpus: "listing",
        label: "qty",
        text: "1 left",
        score: 0.9,
      },
    ],
    guards: [{ guard: "availability", verdict: "allow" }],
    verdict: "allow",
    confidence: 0.86,
    repaired: false,
    spans: {
      admitMs: 1,
      classifyMs: 2,
      retrieveMs: 3,
      composeMs: 4,
      guardMs: 5,
      repairMs: 0,
      totalMs: 800,
      cacheHit: false,
      budgetMs: 2000,
      overBudget: false,
    },
    createdAt: "2026-09-18T10:00:01.000Z",
    ...over,
  };
}

/** What a sighted operator reads off an element — the sr-only half removed. */
function visibleText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sr-only").forEach((n) => n.remove());
  return clone.textContent ?? "";
}

const queueProps = {
  recent: [],
  focusedId: null,
  editingId: null,
  highlightedId: null,
  onFocus: () => {},
  onSend: () => {},
  onEdit: () => {},
  onCancelEdit: () => {},
  onDismiss: () => {},
  onRegenerate: () => {},
  onFlag: () => {},
  onInspect: () => {},
  onCopy: () => {},
};

const railProps = {
  queue: [],
  flashed: {},
  actions: [],
  audit: [],
  onApprove: () => {},
  onReject: () => {},
  onRollback: () => {},
  onRename: () => {},
  onInspect: () => {},
};

describe("an eBay Live show renders every column it renders today", () => {
  const caps = SURFACE_CAPABILITIES.ebaylive;
  const layout = consoleLayout(caps);

  it("asks for the lot rail, the latency meter, the host audio and the action rail", () => {
    expect(layout.lotRail).toBe(true);
    expect(layout.latencyMeter).toBe(true);
    expect(layout.hostAudio).toBe(true);
    expect(layout.actionRail).toBe(true);
    // And not the one it never had.
    expect(layout.threadPanel).toBe(false);
  });

  it("draws the pinned lot, the actions and the audit chain in the show rail", () => {
    render(<ShowRail {...railProps} pinned={listing} showLots={layout.lotRail} />);
    expect(screen.getByText("Pinned lot")).toBeInTheDocument();
    expect(screen.getByText("Air Jordan 1 Chicago Reimagined")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
  });

  it("draws exactly the six guard pills, in order, and the control that matches what accepting does", () => {
    render(<ProposalQueue {...queueProps} live={[proposal()]} guardOrder={guardOrderFor(caps)} />);
    // The visible half only. Each pill also carries an sr-only sentence now
    // (CONTENT-38) — it announced "✕ price" and nothing else before, so the
    // verdict and the reason were mouse-only on the one screen that matters.
    expect(visibleText(screen.getByRole("list", { name: "Guardrail results" }))).toBe(
      "–price✓stock–policy–grounding–tone–pii",
    );
    // eBay Live publishes no chat-post API and nothing wires a deliverer, so
    // the server answers `delivery: "human"` — and a Send button here would be
    // the console promising a delivery the backend has just declined to make.
    expect(screen.queryByText("Send")).not.toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("says the verdict and the reason out loud, not just the glyph", () => {
    render(
      <ProposalQueue {...queueProps} live={[proposal()]} guardOrder={guardOrderFor(caps)} />,
    );
    const pills = screen.getByRole("list", { name: "Guardrail results" });
    const spoken = [...pills.querySelectorAll(".sr-only")].map((n) => n.textContent ?? "");
    expect(spoken.join(" ")).toMatch(/stock passed/);
    expect(spoken.join(" ")).toMatch(/price did not apply/);
  });

  /**
   * CONTENT-19. The copy affordance rendered only on draft-only surfaces, so
   * eBay Live — the surface the landing page names when it says an approved
   * reply is "handed back to you to paste" — had a button labelled Send, a
   * status that read `sent`, and nowhere to copy from. Nothing is delivered on
   * any surface: `send()` re-checks the draft, marks it and appends an audit
   * entry, and there is no platform call on any path. So the copy is the
   * operator's real next step here too, beside Send rather than instead of it.
   */
  it("offers the paste affordance the product promises, beside a Send that can send", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal({ delivery: "api" })]}
        guardOrder={guardOrderFor(caps)}
      />,
    );
    expect(screen.getByText("Send")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("makes copy the only action where the reply is the operator's to post", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal({ delivery: "human" })]}
        guardOrder={guardOrderFor(caps)}
      />,
    );
    expect(screen.queryByText("Send")).not.toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("does not grow a room-rule or sponsor pill", () => {
    render(<ProposalQueue {...queueProps} live={[proposal()]} guardOrder={guardOrderFor(caps)} />);
    const pills = screen.getByRole("list", { name: "Guardrail results" });
    expect(pills.textContent).not.toContain(GUARD_LABEL.community_rule);
    expect(pills.textContent).not.toContain(GUARD_LABEL.sponsor);
  });
});

describe("a surface without a listing corpus", () => {
  it("renders the rail with no pinned lot at all — not an empty one", () => {
    render(
      <ShowRail
        {...railProps}
        pinned={null}
        showLots={consoleLayout(SURFACE_CAPABILITIES.twitch).lotRail}
      />,
    );
    expect(screen.queryByText("Pinned lot")).not.toBeInTheDocument();
    // "No lot pinned." would describe an inventory this surface does not have.
    expect(screen.queryByText("No lot pinned.")).not.toBeInTheDocument();
    // What it does have is still there.
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
  });

  it("shows the room-rule and sponsor pills where the surface has them", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal()]}
        guardOrder={guardOrderFor(SURFACE_CAPABILITIES.twitch)}
      />,
    );
    const pills = screen.getByRole("list", { name: "Guardrail results" });
    expect(pills.textContent).toContain(GUARD_LABEL.community_rule);
    expect(pills.textContent).toContain(GUARD_LABEL.sponsor);
  });
});

describe("a draft-only surface", () => {
  it("offers Copy rather than a Send button that cannot send", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal({ delivery: "human" })]}
        guardOrder={guardOrderFor(SURFACE_CAPABILITIES.reddit)}
      />,
    );
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.queryByText("Send")).not.toBeInTheDocument();
  });
});

/**
 * Delivery is a SERVER contract now, decided per proposal from the surface and
 * from whether a delivery path is wired (backend `Pipeline.deliveryFor`,
 * `src/pipeline/pipeline.ts`). The console used to decide it here, from the
 * capability table, and the table said eBay Live delivered by API — so the
 * reference surface's primary button was a Send over a reply nothing sends.
 */
describe("who sends the reply is read off the card, not off the surface", () => {
  const caps = SURFACE_CAPABILITIES.ebaylive;

  it("offers Send when the server says this proposal is delivered by us", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal({ delivery: "api" })]}
        guardOrder={guardOrderFor(caps)}
      />,
    );
    expect(screen.getByText("Send")).toBeInTheDocument();
  });

  it("offers no Send for the same surface when the server says a human delivers", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal({ delivery: "human" })]}
        guardOrder={guardOrderFor(caps)}
      />,
    );
    expect(screen.queryByText("Send")).not.toBeInTheDocument();
  });

  /** A server too old to send the field is a server that cannot be promising
   *  a delivery. The costly failure is a Send button over a reply nothing
   *  sends; a Copy over a reply that could have been sent costs a paste. */
  it("treats a missing delivery field as the operator's to send", () => {
    // `delivery` is optional on the wire precisely so this case is expressible.
    const { delivery: _absent, ...noField } = proposal();
    render(
      <ProposalQueue {...queueProps} live={[noField]} guardOrder={guardOrderFor(caps)} />,
    );
    expect(screen.queryByText("Send")).not.toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });
});

/**
 * Copying IS accepting, where the reply is the operator's to post.
 *
 * The copy control never called the API, so on every surface in the build the
 * only offered action recorded nothing at all: no audit entry, no answered
 * rate, no Recent line — for a reply the operator had actually used.
 */
describe("copying a reply the operator posts themselves", () => {
  const withClipboard = (writeText: () => Promise<void>) => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  };

  it("records it through the same endpoint Send uses", async () => {
    withClipboard(() => Promise.resolve());
    const onCopy = vi.fn();
    render(
      <ProposalQueue
        {...queueProps}
        onCopy={onCopy}
        live={[proposal({ delivery: "human" })]}
      />,
    );
    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() => expect(onCopy).toHaveBeenCalledWith("p_1", undefined));
  });

  it("records nothing when the clipboard refused — the operator has no words in hand", async () => {
    withClipboard(() => Promise.reject(new Error("denied")));
    const onCopy = vi.fn();
    render(
      <ProposalQueue
        {...queueProps}
        onCopy={onCopy}
        live={[proposal({ delivery: "human" })]}
      />,
    );
    fireEvent.click(screen.getByText("Copy"));
    await screen.findByText("Could not copy");
    expect(onCopy).not.toHaveBeenCalled();
  });

  /** Where the copilot is the sender, Send is the accept and a copy is a copy. */
  it("does not record a copy on a surface that delivers for us", async () => {
    withClipboard(() => Promise.resolve());
    const onCopy = vi.fn();
    render(
      <ProposalQueue {...queueProps} onCopy={onCopy} live={[proposal({ delivery: "api" })]} />,
    );
    fireEvent.click(screen.getByText("Copy"));
    await screen.findByText("Copied");
    expect(onCopy).not.toHaveBeenCalled();
  });
});

describe("the style reference", () => {
  it("is rendered muted, in the server's own words, and never as a guard pill", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[
          proposal({
            styleRef: {
              factId: "persona:doc_9",
              text: "Ships from Lisbon, usually out the same day.",
              label: "Your own words · March 2026",
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("written the way you answered this in March 2026")).toBeInTheDocument();
    // It must not have joined the receipt.
    const pills = screen.getByRole("list", { name: "Guardrail results" });
    expect(pills.textContent).not.toContain("March");
  });

  it("degrades to 'before' when the server sent no label", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal({ styleRef: { factId: "persona:doc_9", text: "…" } })]}
      />,
    );
    expect(screen.getByText("written the way you answered this before")).toBeInTheDocument();
  });

  it("renders nothing at all when there is no style reference", () => {
    render(<ProposalQueue {...queueProps} live={[proposal()]} />);
    expect(screen.queryByText(/written the way you answered this/)).not.toBeInTheDocument();
  });
});

describe("the guard hover", () => {
  it("explains what a guard checks, including one the operator has never met", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal()]}
        guardOrder={guardOrderFor(SURFACE_CAPABILITIES.reddit)}
      />,
    );
    // The hover opens on focus — what an operator reaching for it with a
    // keyboard does. `focusIn` rather than `focus`, because that is the event
    // React's onFocus actually listens for.
    const pills = screen.getByRole("list", { name: "Guardrail results" });
    const pill = [...pills.querySelectorAll('[aria-hidden="true"]')].find(
      (n) => n.textContent === GUARD_LABEL.community_rule,
    )!;
    fireEvent.focusIn(pill);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toMatch(/the room's own rules are constraints on the reply/i);
  });
});

describe("evidence from a corpus this build has never seen", () => {
  it("still draws a chip rather than crashing the queue", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ProposalQueue
        {...queueProps}
        live={[
          proposal({
            evidence: [
              {
                factId: "x:1",
                // A source from a backend newer than this bundle.
                source: "telemetry" as never,
                label: "whatever",
                text: "…",
                score: 0.5,
              },
            ],
          }),
        ]}
      />,
    );
    expect(screen.getByText("whatever")).toBeInTheDocument();
    spy.mockRestore();
  });
});
