import { afterEach, describe, expect, it, vi } from "vitest";
import { openAudioBridge } from "./bridge";
import { api } from "./api";

// Opening the bridge must never put the operator's account session in a URL.
//
// The bridge is a second tab, so its credential lands in the address bar, the
// history and any log that records a path. It used to be the full session
// token, which reaches every show the operator owns and every route in the
// product. The server has always minted a narrow one — `sbt_`, one show, one
// hour, confined to that show's audio and visual ingest.

const fakeTab = () => ({ location: { replace: vi.fn() }, close: vi.fn() });

afterEach(() => vi.restoreAllMocks());

describe("opening the audio bridge", () => {
  it("asks the server for a show-scoped token and never builds the URL itself", async () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const mint = vi
      .spyOn(api, "bridgeToken")
      .mockResolvedValue({ token: "sbt_abc", expiresAt: "", showId: "s1", url: "/audio-bridge?showId=s1&token=sbt_abc" });

    expect(await openAudioBridge("s1")).toEqual({ ok: true });
    expect(mint).toHaveBeenCalledWith("s1");
    const went = tab.location.replace.mock.calls[0]![0] as string;
    expect(went).toContain("token=sbt_abc");
    // The narrow token, and only it.
    expect(went).toContain("sbt_");
  });

  it("opens the tab inside the gesture, before the round trip", async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    let resolve!: (v: unknown) => void;
    vi.spyOn(api, "bridgeToken").mockReturnValue(new Promise((r) => (resolve = r)) as never);

    const p = openAudioBridge("s1");
    // A popup opened after an await is a popup blocked, so it must already exist.
    expect(open).toHaveBeenCalledTimes(1);
    resolve({ token: "t", expiresAt: "", showId: "s1", url: "/audio-bridge?showId=s1&token=t" });
    await p;
  });

  it("says so when the browser blocked the tab", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(await openAudioBridge("s1")).toEqual({ ok: false, reason: "blocked" });
  });

  it("closes the tab it opened when minting fails, rather than leaving a blank one", async () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.spyOn(api, "bridgeToken").mockRejectedValue(new Error("410"));

    expect(await openAudioBridge("s1")).toEqual({ ok: false, reason: "failed" });
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
  });
});
