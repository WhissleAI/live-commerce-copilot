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
import { ArrowRight, Check, Circle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { CatalogSummary, EbayStatus, HomeView } from "@/lib/types";
import { Badge, Button, Card, SectionHeading, Skeleton } from "@/components/ui/kit";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  action?: { label: string; to: string; search?: Record<string, string> };
}

export function YourShowCard() {
  // `undefined` is "not read yet"; `null` is "the read failed". They used to be
  // the same value, so a backend that answered 500 left this card on
  // "checking your setup…" for the rest of the session.
  const [ebay, setEbay] = useState<EbayStatus | null | undefined>(undefined);
  const [home, setHome] = useState<HomeView | null | undefined>(undefined);
  const [catalogs, setCatalogs] = useState<CatalogSummary[] | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const read = () => {
    setFailed(false);
    void api
      .ebayStatus()
      .then(setEbay)
      .catch(() => {
        setEbay(null);
        setFailed(true);
      });
    void api
      .home()
      .then(setHome)
      .catch(() => {
        setHome(null);
        setFailed(true);
      });
    void api
      .catalogs()
      .then(setCatalogs)
      .catch(() => {
        setCatalogs(null);
        setFailed(true);
      });
  };
  useEffect(read, []);

  const loading = ebay === undefined || home === undefined || catalogs === undefined;

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
      done: Boolean(
        session?.present &&
        !session.stale &&
        !["blocked", "signed-out"].includes(home?.discovery.reason ?? ""),
      ),
      detail: session?.present
        ? session.stale
          ? "the session has gone stale — sign in again"
          : home?.discovery.reason === "signed-out"
            ? "eBay signed the saved session out — sign in again from the address the server uses; attaching by link works meanwhile"
            : home?.discovery.reason === "blocked"
              ? "eBay serves this session the anonymous grid — Discover and Prepare run on your own machine; attaching by link works here"
              : "Discover and show preparation can see the live grid"
        : "nothing on eBay Live is visible to a signed-out visitor",
      ...(session?.present &&
      !session.stale &&
      !["blocked", "signed-out"].includes(home?.discovery.reason ?? "")
        ? {}
        : { action: { label: "How to sign in", to: "/", search: { view: "discover" } } }),
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
      ...(live || prepared.length
        ? {}
        : { action: { label: "Discover shows", to: "/", search: { view: "discover" } } }),
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
          <div aria-busy="true" aria-label="checking your setup">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <Skeleton className="size-4 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-[13px] w-40" />
                  <Skeleton className="mt-1.5 h-[11px] w-72" />
                </div>
              </div>
            ))}
          </div>
        ) : failed ? (
          <div className="flex items-center gap-3 px-4 py-3 text-[12.5px] text-text-secondary">
            <span className="min-w-0 flex-1">
              Could not read your setup — the backend did not answer. The checklist is shown from
              what did arrive.
            </span>
            <Button size="sm" onClick={read}>
              <RefreshCw className="size-3" aria-hidden /> Retry
            </Button>
          </div>
        ) : null}
        {!loading
          ? steps.map((s) => (
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
          : null}
      </Card>
    </div>
  );
}
