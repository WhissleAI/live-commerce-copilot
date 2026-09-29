/**
 * In production, nothing was listening.
 *
 * `reportLovableError` is what BOTH console error boundaries call — the route-level
 * one and the per-panel one whose whole job is to keep one panel's failure from
 * blanking a seller's screen mid-show. It forwarded to `window.__lovableEvents`
 * and `window.__lovableReportRuntimeError`, two globals the Lovable editor
 * injects. Verified against the deployed site: no `lovable` script in the HTML of
 * `/` or `/console`, so both are undefined and the function did nothing at all.
 *
 * The console degraded correctly and told nobody.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { reportLovableError } from "./lovable-error-reporting";

describe("an error the browser caught", () => {
  let sent: { url: string; body: Record<string, unknown>; init: RequestInit }[] = [];

  beforeEach(() => {
    sent = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      sent.push({ url, init, body: JSON.parse(String(init.body)) });
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reaches the server, which is the whole point", () => {
    reportLovableError(new TypeError("Cannot read properties of null"), {
      boundary: "console_panel",
      panel: "Buyer chat",
    });
    expect(sent.length, "nothing was sent").toBe(1);
    expect(sent[0]!.url).toContain("/api/client-error");
    expect(sent[0]!.body["kind"]).toBe("panel");
    expect(sent[0]!.body["where"]).toBe("Buyer chat");
    // The panel's name and the error's own name are the two things that make a
    // report actionable rather than a count.
    expect(String(sent[0]!.body["err"])).toContain("TypeError");
    expect(String(sent[0]!.body["err"])).toContain("Cannot read properties of null");
  });

  it("says which bundle the browser was running", () => {
    // A seller on a stale tab is a different report from one on the current build.
    reportLovableError(new Error("boom"), { boundary: "tanstack_root_error_component" });
    expect(String(sent[0]!.body["build"])).toMatch(/^\d{8}T\d{6}$/);
    expect(sent[0]!.body["kind"]).toBe("route");
  });

  it("survives the unload an error often precedes", () => {
    reportLovableError(new Error("boom"));
    expect(sent[0]!.init.keepalive, "without keepalive the report dies with the page").toBe(true);
  });

  it("never becomes the reason a page fails", () => {
    // A reporter that throws inside an error boundary turns a broken panel into a
    // broken page.
    vi.stubGlobal("fetch", () => {
      throw new Error("network is gone");
    });
    expect(() => reportLovableError(new Error("boom"))).not.toThrow();
  });

  it("still calls the editor hooks, where they exist", () => {
    // They are undefined in production, which was the bug — but inside the Lovable
    // preview they are the only thing that works, so both paths run.
    const captured: unknown[] = [];
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("{}")));
    (window as unknown as { __lovableEvents: unknown }).__lovableEvents = {
      captureException: (e: unknown) => captured.push(e),
    };
    const err = new Error("boom");
    reportLovableError(err);
    expect(captured).toEqual([err]);
    delete (window as unknown as { __lovableEvents?: unknown }).__lovableEvents;
  });
});
