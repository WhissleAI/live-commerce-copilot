import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LandingPage } from "@/components/pages/LandingPage";
import { ShowsPage } from "@/components/pages/ShowsPage";
import { ensureSession, signedIn } from "@/lib/api";

export const Route = createFileRoute("/")({
  // `/?view=discover` opens Home on its Discover tab — the one deep link the
  // readiness checklist and the command palette need.
  validateSearch: (s: Record<string, unknown>): { view?: "discover" } =>
    s["view"] === "discover" ? { view: "discover" } : {},
  head: () => ({
    meta: [
      { title: "SideStage — Live Selling Copilot" },
      {
        name: "description",
        content:
          "A copilot for eBay Live sellers: it watches the show, drafts every reply behind six guards, proposes bounded actions, and reports afterwards. You keep the last word.",
      },
      { property: "og:title", content: "SideStage — Live Selling Copilot" },
      {
        property: "og:description",
        content: "It watches the show. It answers the room. You keep the last word.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: function Home() {
    // The front door. A visitor sees the landing page; a signed-in seller
    // lands on Home — their shows, the paste box, and Discover. The console
    // is a destination of its own (/console) and only worth a rail button
    // while a show is on air. Decided on the client, where the session lives.
    const { view } = Route.useSearch();
    const [state, setState] = useState<"unknown" | "in" | "out">("unknown");
    useEffect(() => {
      // Only a 401 demotes a seller to the landing page. ensureSession clears
      // the token on 401 alone, so a blip on /me (network, a restart) leaves
      // signedIn() true and the seller stays where they were.
      void ensureSession().then((a) => setState(a || signedIn() ? "in" : "out"));
    }, []);
    if (state === "unknown") return null;
    return state === "in" ? (
      <ShowsPage view={view === "discover" ? "discover" : "live"} />
    ) : (
      <LandingPage />
    );
  },
});
