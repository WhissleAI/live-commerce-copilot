import { describe, expect, it, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useInView } from "./useInView";

/**
 * The report's frame thumbnails used `loading="lazy"` and never loaded.
 * Measured on production: 34 of them, one visible on screen, polled for
 * fourteen seconds — nothing fetched, no error, no broken-image icon. The
 * URLs were fine (`200 image/jpeg`) and the same element loaded the instant
 * `loading` was removed. This hook is that deferral, somewhere testable.
 */
function Probe() {
  const [ref, near] = useInView();
  return <div ref={ref} data-testid="box">{near ? "near" : "far"}</div>;
}

const realIO = globalThis.IntersectionObserver;
afterEach(() => {
  globalThis.IntersectionObserver = realIO;
  vi.restoreAllMocks();
});

describe("useInView", () => {
  it("starts far, and turns near when the observer fires", () => {
    let fire: ((e: { isIntersecting: boolean }[]) => void) | null = null;
    const disconnect = vi.fn();
    globalThis.IntersectionObserver = vi.fn((cb: never) => {
      fire = cb as unknown as typeof fire;
      return { observe: vi.fn(), disconnect, unobserve: vi.fn() };
    }) as never;

    render(<Probe />);
    expect(screen.getByTestId("box")).toHaveTextContent("far");

    act(() => fire!([{ isIntersecting: true }]));
    expect(screen.getByTestId("box")).toHaveTextContent("near");
    expect(disconnect).toHaveBeenCalled();
  });

  it("does not turn near on a non-intersecting entry", () => {
    let fire: ((e: { isIntersecting: boolean }[]) => void) | null = null;
    globalThis.IntersectionObserver = vi.fn((cb: never) => {
      fire = cb as unknown as typeof fire;
      return { observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() };
    }) as never;

    render(<Probe />);
    act(() => fire!([{ isIntersecting: false }]));
    expect(screen.getByTestId("box")).toHaveTextContent("far");
  });

  it("shows the content when there is no IntersectionObserver at all", () => {
    // Fetching a thumbnail too eagerly is a smaller failure than one that
    // never appears — which is the bug this replaces.
    // @ts-expect-error deleting a global for the test
    delete globalThis.IntersectionObserver;
    render(<Probe />);
    expect(screen.getByTestId("box")).toHaveTextContent("near");
  });
});
