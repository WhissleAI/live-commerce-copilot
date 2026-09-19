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
import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(layout.deliverable).toBe(true);
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

  it("draws exactly the six guard pills, in order, and a Send button", () => {
    render(
      <ProposalQueue
        {...queueProps}
        live={[proposal()]}
        guardOrder={guardOrderFor(caps)}
        deliverable={layout.deliverable}
      />,
    );
    const pills = screen.getByRole("list", { name: "Guardrail results" });
    expect(pills.textContent).toBe("–price✓stock–policy–grounding–tone–pii");
    expect(screen.getByText("Send")).toBeInTheDocument();
    expect(screen.queryByText("Copy")).not.toBeInTheDocument();
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
        live={[proposal()]}
        guardOrder={guardOrderFor(SURFACE_CAPABILITIES.reddit)}
        deliverable={consoleLayout(SURFACE_CAPABILITIES.reddit).deliverable}
      />,
    );
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.queryByText("Send")).not.toBeInTheDocument();
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
    fireEvent.focusIn(screen.getByText(GUARD_LABEL.community_rule));
    expect(
      screen.getByText(/the room's own rules are constraints on the reply/i),
    ).toBeInTheDocument();
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
