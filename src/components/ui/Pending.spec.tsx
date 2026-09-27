import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pending } from "./kit";

// A read that failed leaves the same `null` a read still in flight does, so the
// natural `{!data ? <Skeleton/> : …}` shimmers forever when it failed. A
// shimmer means "wait", which is the one instruction that is not true — and on
// Cost it sat directly under a banner saying the read could not be done, so
// the page contradicted itself.

describe("a placeholder that knows whether the load failed", () => {
  it("shimmers while the data is genuinely still coming", () => {
    const { container } = render(<Pending className="h-[92px]" />);
    expect(screen.queryByText(/did not load/)).not.toBeInTheDocument();
    expect(container.querySelector(".h-\\[92px\\]")).toBeInTheDocument();
  });

  it("stops shimmering and says so once it has failed", () => {
    render(<Pending failed="502 from the gateway" what="The session table" />);
    expect(screen.getByText(/The session table did not load/)).toBeInTheDocument();
    expect(screen.getByText(/502 from the gateway/)).toBeInTheDocument();
  });

  it("says a failed read is not an empty one", () => {
    render(<Pending failed="timeout" />);
    expect(screen.getByText(/failed read, not an empty one/)).toBeInTheDocument();
  });

  it("treats null and undefined as still loading, not as failed", () => {
    render(<Pending failed={null} />);
    expect(screen.queryByText(/did not load/)).not.toBeInTheDocument();
    render(<Pending failed={undefined} />);
    expect(screen.queryByText(/did not load/)).not.toBeInTheDocument();
  });
});
