import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegendOverlay } from "./LegendOverlay";
import { GUARD_LABEL, GUARD_MEANS, GUARD_ORDER } from "@/lib/format";

describe("LegendOverlay", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<LegendOverlay open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains how to read a pill — passed, revised, blocked, not applicable", () => {
    render(<LegendOverlay open onClose={() => {}} />);
    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(screen.getByText("revised")).toBeInTheDocument();
    expect(screen.getByText("blocked")).toBeInTheDocument();
    expect(screen.getByText("not applicable")).toBeInTheDocument();
  });

  it("explains what each of the six existing guards checks", () => {
    render(<LegendOverlay open onClose={() => {}} />);
    GUARD_ORDER.forEach((g) => {
      expect(screen.getByText(GUARD_MEANS[g])).toBeInTheDocument();
    });
  });

  // The two new guards are met HERE, before an operator ever sees one, or the
  // absence of a pill they have never seen reads as something missing.
  it("explains the two surface-specific guards and says where they run", () => {
    render(<LegendOverlay open onClose={() => {}} />);
    expect(screen.getByText(GUARD_LABEL.community_rule)).toBeInTheDocument();
    expect(screen.getByText(GUARD_LABEL.sponsor)).toBeInTheDocument();
    expect(screen.getByText(GUARD_MEANS.community_rule)).toBeInTheDocument();
    expect(screen.getByText(GUARD_MEANS.sponsor)).toBeInTheDocument();
    expect(screen.getByText(/only where the room has rules of its own/)).toBeInTheDocument();
    expect(
      screen.getByText(/only where a sponsored segment has approved copy/),
    ).toBeInTheDocument();
  });

  // Asserts the DISTINCTION, not one phrasing of it. The previous version
  // matched the sentence word for word and failed on a rewrite that said the
  // same thing in fewer words.
  it("says the six are six and the extra two are extra", () => {
    render(<LegendOverlay open onClose={() => {}} />);
    const copy = screen.getByText(/Six guards run on every reply/);
    expect(copy).toBeInTheDocument();
    expect(copy.textContent).toMatch(/plus two\s+where the surface has them/);
  });
});
