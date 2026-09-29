import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl, SITE_TITLE, siteMeta } from "@/lib/meta";
import { useEffect, useLayoutEffect, useState } from "react";
import { LandingPage } from "@/components/pages/LandingPage";
import { HomePage } from "@/components/pages/HomePage";
import { ensureSession, signedIn } from "@/lib/api";
import { frontDoor } from "@/lib/front-door";

/**
 * A layout effect on the client, a no-op on the server.
 *
 * React warns when a component that server-renders calls `useLayoutEffect`,
 * and it is right to: nothing runs. The reason this file wants one anyway is
 * below, at the front door's first paint.
 */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const Route = createFileRoute("/")({
  // `/?view=discover` opens Home on its Discover tab — the one deep link the
  // surface table's eBay Live steps and the command palette need.
  validateSearch: (s: Record<string, unknown>): { view?: "discover" } =>
    s["view"] === "discover" ? { view: "discover" } : {},
  // One description constant, shared with the root head — see `lib/meta`.
  // These were two divergent copies and the older one was the one most link
  // previews resolved.
  head: () => ({
    meta: [{ title: SITE_TITLE }, ...siteMeta("/")],
    // The front door is the one page with a canonical URL worth stating: it is
    // reachable as `/`, as `/?view=discover`, and behind every marketing link
    // that adds a tracking parameter, and each of those is the same page.
    links: [{ rel: "canonical", href: absoluteUrl("/") }],
  }),
  component: function Home() {
    // The front door. A visitor sees the landing page; a signed-in seller
    // lands on Home — what needs them now, what they are preparing, what
    // finished, and the per-surface phase table. The console is a destination
    // of its own (/console) and only worth a rail button while a session is on
    // air. Decided on the client, where the session lives.
    const { view } = Route.useSearch();
    const [state, setState] = useState<"unknown" | "in" | "out">("unknown");

    // CONTENT-14. Before this, `unknown` rendered null — so the server sent a
    // document with a head and an empty body, and the front door's content
    // existed only after /api/auth/me answered from EC2. Two costs, one cause:
    // a visitor's first paint was blank for a whole round trip, and every
    // client that does not run JS — the AI answer engines, most unfurlers, and
    // Google's first pass — read the page as having nothing in it. The copy
    // three rounds of work went into was invisible to all of them.
    //
    // `unknown` renders the landing page now. It is the honest default: it is
    // what an unauthenticated request should get, it is what SSR can know
    // without a session, and it means the markup a crawler receives is the
    // page a person receives.
    useBeforePaint(() => {
      // The trade-off, stated plainly: a signed-in seller now sees the landing
      // page for as long as the bundle takes to hydrate. This runs before the
      // first paint AFTER hydration, and `signedIn()` is a synchronous read of
      // localStorage, so no network call stands between the two — which makes
      // that window strictly shorter than the blank page plus the /me round
      // trip it replaces. The token lives in localStorage, so the server
      // cannot know who is asking; a cookie could, and would cost every
      // request a session read to save a seller one frame.
      if (signedIn()) setState("in");
    }, []);

    useEffect(() => {
      // Only a 401 demotes a seller to the landing page. ensureSession clears
      // the token on 401 alone, so a blip on /me (network, a restart) leaves
      // signedIn() true and the seller stays where they were.
      void ensureSession().then((a) => setState(a || signedIn() ? "in" : "out"));
    }, []);

    return frontDoor(state) === "home" ? (
      <HomePage view={view === "discover" ? "discover" : "today"} />
    ) : (
      <LandingPage />
    );
  },
});
