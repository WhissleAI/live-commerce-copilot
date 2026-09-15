/**
 * The seller's own setup, at the top of Shows — because the PRD's user is Rae
 * running HER show, and the page's front door was "paste someone else's
 * stream".
 *
 * Four things have to be true before the copilot can do its actual job for a
 * seller, and until now each lived on a different screen with nothing saying
 * which were done: eBay connected (so writes are real), a catalog loaded (so
 * replies are grounded), the eBay Live session (so Discover and preparation
 * work), and a prepared or live show. This is that checklist, with the next
 * step as the action — and it steps aside once everything is in place, because
 * a checklist that stays after completion is clutter.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Circle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { CatalogSummary, EbayStatus, HomeView } from "@/lib/types";
import { Badge, Button, Card, SectionHeading } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  action?: { label: string; to: string; search?: Record<string, string> };
}

export function YourShowCard() {
  const [ebay, setEbay] = useState<EbayStatus | null>(null);
  const [home, setHome] = useState<HomeView | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogSummary[] | null>(null);

  useEffect(() => {
    void api
      .ebayStatus()
      .then(setEbay)
      .catch(() => setEbay(null));
    void api
      .home()
      .then(setHome)
      .catch(() => setHome(null));
    void api
      .catalogs()
      .then(setCatalogs)
      .catch(() => setCatalogs([]));
  }, []);

  const loading = ebay === null || home === null || catalogs === null;

  // Catalogs written by the eBay importer or by preparing a show are the
  // seller's own; the two shipped fixtures are demo inventory.
  const own = (catalogs ?? []).filter((c) => !["kicksbyrae", "curated-cards"].includes(c.id));
  const session = home?.discovery.session;
  const prepared = home?.prepared ?? [];
  const live = home?.watching.some((w) => w.status === "live") ?? false;

  const steps: Step[] = [
    {
      id: "session",
      label: "Signed in to eBay Live",
      // A session the grid refuses is not a session that helps: from a server
      // address eBay hands back an anonymous grid even on valid cookies.
      done: Boolean(session?.present && !session.stale && !["blocked", "signed-out"].includes(home?.discovery.reason ?? "")),
      detail: session?.present
        ? session.stale
          ? "the session has gone stale — sign in again"
          : home?.discovery.reason === "signed-out"
            ? "eBay signed the saved session out — sign in again from the address the server uses; attaching by link works meanwhile"
            : home?.discovery.reason === "blocked"
              ? "eBay serves this session the anonymous grid — Discover and Prepare run on your own machine; attaching by link works here"
              : "Discover and show preparation can see the live grid"
        : "nothing on eBay Live is visible to a signed-out visitor",
      ...(session?.present && !session.stale && !["blocked", "signed-out"].includes(home?.discovery.reason ?? "")
        ? {}
        : { action: { label: "How to sign in", to: "/shows" } }),
    },
    {
      id: "ebay",
      label: "eBay account connected",
      done: Boolean(ebay?.write.connected),
      detail: ebay?.write.connected
        ? "markdowns, stock changes and ended listings can act on your real listings"
        : ebay?.write.blockers.length
          ? "the application still needs a registered redirect before you can consent"
          : "sign in at eBay once so actions can reach your listings",
      ...(ebay?.write.connected
        ? {}
        : { action: { label: "Connect", to: "/settings", search: { tab: "ebay" } } }),
    },
    {
      id: "catalog",
      label: "Your catalog loaded",
      done: own.length > 0,
      detail: own.length
        ? `${own.length} of your own — ${own.reduce((a, c) => a + c.itemCount, 0)} lots the copilot can cite`
        : "import your listings, or prepare a show and its catalog is built for you",
      ...(own.length
        ? {}
        : { action: { label: "Import listings", to: "/settings", search: { tab: "ebay" } } }),
    },
    {
      id: "show",
      label: live ? "A show is on air" : "Next show prepared",
      done: live || prepared.length > 0,
      detail: live
        ? "the console is grounded and listening"
        : prepared.length
          ? `${prepared.length} prepared — each with its own agent and catalog`
          : "prepare a show before it starts, so the first question is answered from a full catalog",
      ...(live || prepared.length ? {} : { action: { label: "Discover shows", to: "/shows" } }),
    },
  ];

  const done = steps.filter((s) => s.done).length;

  // Everything in place: one line, not a checklist.
  if (!loading && done === steps.length) {
    return (
      <Card className="mb-8 flex items-center gap-3 px-4 py-3">
        <Check className="size-4 text-ok" aria-hidden />
        <span className="text-[12.5px]">
          You are set up — eBay connected, catalog loaded, signed in to eBay Live
          {live
            ? ", and a show is on air."
            : `, and ${prepared.length} show${prepared.length === 1 ? "" : "s"} prepared.`}
        </span>
        {live ? (
          <Link to="/console" className="ml-auto">
            <Button size="sm" variant="primary">
              Open console <ArrowRight className="size-3" aria-hidden />
            </Button>
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-baseline gap-2">
        <SectionHeading hint="The copilot answers from your catalog, acts on your listings, and prepares for your shows before they start. Each of these unlocks one of those.">
          Your show
        </SectionHeading>
        {!loading ? (
          <Badge className="ml-auto translate-y-[-2px]">
            {done}/{steps.length} ready
          </Badge>
        ) : null}
      </div>
      <Card className="mt-3 divide-y divide-hairline">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-text-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> checking your setup…
          </div>
        ) : (
          steps.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              {s.done ? (
                <Check className="size-4 shrink-0 text-ok" aria-hidden />
              ) : (
                <Circle className="size-4 shrink-0 text-text-faint" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <div className={cn("text-[12.5px]", s.done ? "text-text" : "font-medium")}>
                  {s.label}
                </div>
                <div className="truncate text-[11.5px] text-text-muted">{s.detail}</div>
              </div>
              {!s.done && s.action ? (
                <Link to={s.action.to} search={s.action.search ?? {}}>
                  <Button size="sm">
                    {s.action.label} <ArrowRight className="size-3" aria-hidden />
                  </Button>
                </Link>
              ) : null}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
