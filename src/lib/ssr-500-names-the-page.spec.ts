import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * A 500 from SSR logged a stack and no path.
 *
 * Which page broke is the first question anyone asks, and it was the one thing
 * the log did not answer — and it matters twice over here, because the stack
 * itself is recovered from module state and is only PROBABLY this request's.
 * The path is what makes a misattributed stack visible.
 *
 * The query string stays out: it can carry a token, an email or a show id, and
 * a log line is where those become durable.
 */
describe("what an SSR 500 says", () => {
  let logged: unknown[][] = [];
  let original: typeof console.error;

  beforeEach(() => {
    logged = [];
    original = console.error;
    console.error = (...a: unknown[]) => void logged.push(a);
  });
  afterEach(() => {
    console.error = original;
  });

  it("names the path and keeps the query string out of it", async () => {
    const { default: entry } = await import("../server");
    const boom = new Error("component threw");
    vi.doMock("@tanstack/react-start/server-entry", () => ({
      default: {
        fetch: () => {
          throw boom;
        },
      },
    }));
    const res = await entry.fetch(
      new Request("https://sidestage.whissle.ai/reports/show_x?token=sst_secret"),
      {},
      {},
    );
    expect(res.status).toBe(500);
    const line = logged.find((a) => typeof a[0] === "string" && a[0].includes("/reports/show_x"));
    expect(line, `nothing named the path; logged: ${JSON.stringify(logged.map((a) => a[0]))}`).toBeTruthy();
    expect(String(line![0])).not.toContain("sst_secret");
    // `error-capture` wraps console.error and expands an Error argument into a
    // string carrying the message, stack and cause chain — the whole reason it
    // exists. So the second argument is that description, not the Error.
    expect(String(line![1])).toContain("component threw");
  });

  it("names the path on an h3-swallowed 500 too — the case where the stack is only probably this request's", async () => {
    vi.resetModules();
    vi.doMock("@tanstack/react-start/server-entry", () => ({
      default: {
        fetch: () =>
          // Exactly what h3 returns when it eats an in-handler throw.
          new Response(JSON.stringify({ status: 500, unhandled: true, message: "HTTPError" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          }),
      },
    }));
    const { default: entry } = await import("../server");
    const res = await entry.fetch(new Request("https://sidestage.whissle.ai/settings?tab=ebay"), {}, {});
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("text/html");
    const line = logged.find((a) => typeof a[0] === "string" && a[0].includes("SSR 500 on /settings"));
    expect(line, `logged: ${JSON.stringify(logged.map((a) => a[0]))}`).toBeTruthy();
    expect(String(line![0])).not.toContain("tab=ebay");
  });
});
