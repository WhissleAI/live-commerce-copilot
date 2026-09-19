import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThreadPanel } from "./ThreadPanel";
import type { ThreadContext } from "@/lib/types";

const thread: ThreadContext = {
  threadId: "t_1abc2de",
  room: "r/mechmarket",
  summary: "Someone is asking whether the GMK set ships from inside the EU.",
  ancestors: [
    { author: "u/olivia", text: "[WTS] GMK Olivia, unused", at: "2026-09-15T10:00:00.000Z" },
    { author: "u/buyer", text: "Does this ship from the EU?", at: "2026-09-16T09:00:00.000Z" },
  ],
  rules: [
    {
      factId: "community:mechmarket#3",
      source: "policy",
      corpus: "community",
      label: "rule 3",
      text: "No vendor self-promotion outside the weekly thread.",
      score: 1,
    },
  ],
};

describe("ThreadPanel", () => {
  it("shows the room, the opening post and the branch above it", () => {
    render(<ThreadPanel thread={thread} />);
    expect(screen.getByText("r/mechmarket")).toBeInTheDocument();
    expect(screen.getByText("[WTS] GMK Olivia, unused")).toBeInTheDocument();
    expect(screen.getByText("Does this ship from the EU?")).toBeInTheDocument();
    // The first ancestor is marked as the post everything else hangs off.
    expect(screen.getByText("opening post")).toBeInTheDocument();
    expect(screen.getByText("2 above")).toBeInTheDocument();
  });

  it("renders the room's rules under their own heading, as constraints", () => {
    render(<ThreadPanel thread={thread} />);
    expect(screen.getByText("rules of the room")).toBeInTheDocument();
    expect(screen.getByText("rule 3")).toBeInTheDocument();
    // The sentence that keeps a rule out of the evidence list.
    expect(
      screen.getByText("Constraints on the reply, never facts to answer from."),
    ).toBeInTheDocument();
  });

  it("says nothing is focused rather than drawing an empty thread", () => {
    render(<ThreadPanel thread={null} room="r/mechmarket" />);
    expect(screen.getByText(/Focus a proposal to read the post it answers/i)).toBeInTheDocument();
    // The room is still named: the panel knows where it is even with nothing in it.
    expect(screen.getByText("r/mechmarket")).toBeInTheDocument();
    expect(screen.queryByText("rules of the room")).not.toBeInTheDocument();
  });

  // The degrade path: a surface that gives us a thread id and nothing else.
  it("survives a thread with no ancestors, no rules and no summary", () => {
    render(
      <ThreadPanel
        thread={{ threadId: "t_2", room: "r/x", ancestors: [], rules: [], summary: null }}
      />,
    );
    expect(screen.getByText("This is the opening post — nothing above it.")).toBeInTheDocument();
    expect(screen.queryByText("rules of the room")).not.toBeInTheDocument();
  });

  it("survives a payload missing the fields entirely", () => {
    const half = { threadId: "t_3", room: "r/y" } as unknown as ThreadContext;
    expect(() => render(<ThreadPanel thread={half} />)).not.toThrow();
    expect(screen.getByText("This is the opening post — nothing above it.")).toBeInTheDocument();
  });
});
