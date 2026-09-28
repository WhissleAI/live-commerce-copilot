// Opening the audio bridge with a token that only opens the audio bridge.
//
// The bridge runs in its own tab because it needs a user gesture to call
// `getDisplayMedia` — the server cannot start a capture. A separate tab means
// the credential travels in a URL, which is the one place a long-lived session
// token must never be: the address bar, the history, the referer, any log that
// records a path.
//
// So it is minted per click and it is narrow — `sbt_`, one show, sixty minutes,
// confined server-side to that show's audio and visual ingest.
//
// Minting takes a round trip, and a popup opened after an await is a popup
// blocked. The tab is therefore opened SYNCHRONOUSLY inside the gesture and
// pointed at the URL once it arrives; a failure closes the tab it opened rather
// than leaving a blank one behind.
//
// The gesture was right and the feature string was not: see `openAudioBridge`.
import { api, API_BASE } from "./api";

export type BridgeOpenResult = { ok: true } | { ok: false; reason: "blocked" | "failed" };

export async function openAudioBridge(showId: string): Promise<BridgeOpenResult> {
  // No `noopener` here, and that is the whole fix.
  //
  // `window.open(..., "noopener")` returns NULL by specification — the flag
  // exists to sever the handle, and `noreferrer` implies it. So
  // `window.open("", "_blank", "noopener,noreferrer")` always returned null,
  // the guard below always fired, and every click reported "your browser
  // blocked the bridge tab" no matter what the browser did. Host audio has
  // never opened from this path.
  //
  // Nothing is given up. The tab is opened on `about:blank` and navigated to
  // the API origin, which is ours, and the bridge page sends its own
  // `referrer-policy: no-referrer` (routes.ts) — so the referrer half was
  // already handled where it can be enforced rather than requested.
  const tab = window.open("", "_blank");
  if (!tab) return { ok: false, reason: "blocked" };
  try {
    const { url } = await api.bridgeToken(showId);
    // The server hands back a root-relative path; it belongs to the API origin,
    // not to the console's.
    tab.location.replace(url.startsWith("http") ? url : `${API_BASE}${url}`);
    return { ok: true };
  } catch {
    tab.close();
    return { ok: false, reason: "failed" };
  }
}
