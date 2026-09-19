/**
 * Who you are here, what you have connected, and what is kept.
 *
 * The rail's account button used to sign you out — a profile is what a person
 * expects from it. Signing out is a button on this page, said plainly.
 *
 * Connections used to be one hard-coded eBay card, which was honest when eBay
 * was the only place a reply could land. It is now the same per-surface rows
 * home's surface table is built from, so "what have I connected" has exactly
 * one answer in the product rather than one per screen. The eBay consent flow
 * is untouched — it is the row's action, not a special case above the list.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, RefreshCw } from "lucide-react";
import { api, ensureSession, logout } from "@/lib/api";
import { homeModel, missingLine } from "@/lib/home";
import type {
  Account,
  CatalogSummary,
  EbayStatus,
  HomeSurfaceRow,
  HomeView,
  ShowRow,
  SurfaceDraft,
  SurfaceInfo,
} from "@/lib/types";
import { AppShell } from "@/components/app/AppShell";
import { Badge, Button, Card, SectionHeading, Skeleton } from "@/components/ui/kit";

export function AccountPage() {
  // `undefined` is "not read yet", `null` is "the read failed" — so a failed
  // read shows a retry instead of dashes that look like an empty account.
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [ebay, setEbay] = useState<EbayStatus | null | undefined>(undefined);
  const [connections, setConnections] = useState<HomeSurfaceRow[] | null>(null);

  const read = () => {
    setAccount(undefined);
    setEbay(undefined);
    setConnections(null);
    void ensureSession()
      .then((a) => setAccount(a ?? null))
      .catch(() => setAccount(null));
    void api
      .ebayStatus()
      .then(setEbay)
      .catch(() => setEbay(null));
    // The same rows home renders. Built through `homeModel` so the two
    // screens cannot drift into two ideas of what "connected" means.
    void (async () => {
      const [home, surfaces, catalogs] = await Promise.all([
        api.home().catch(() => null as HomeView | null),
        api.surfaces().catch(() => null as SurfaceInfo[] | null),
        api.catalogs().catch(() => null as CatalogSummary[] | null),
      ]);
      const status = await api.ebayStatus().catch(() => null);
      setConnections(
        homeModel({
          home,
          surfaces,
          catalogs,
          ebay: status,
          reports: null as ShowRow[] | null,
          drafts: null as SurfaceDraft[] | null,
        }).surfaces,
      );
    })();
  };
  useEffect(read, []);

  return (
    <AppShell section="account" title="Account" subtitle={account?.email ?? "your account"}>
      <SectionHeading hint="Every send, approval, eBay consent and deleted show is recorded against this account in the audit chain — which is the only way “who approved that markdown” has an answer.">
        You
      </SectionHeading>
      <Card className="mt-3 divide-y divide-hairline">
        {account === null ? (
          <div className="flex items-center gap-3 px-4 py-3 text-[12.5px] text-text-secondary">
            <span className="min-w-0 flex-1">
              Could not read your account — the backend did not answer.
            </span>
            <Button size="sm" onClick={read}>
              <RefreshCw className="size-3" aria-hidden /> Retry
            </Button>
          </div>
        ) : (
          [
            ["Name", account?.displayName],
            ["Email", account?.email],
            ["Handle", account?.handle],
            ["Account id", account?.id],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between gap-4 px-4 py-2.5 text-[12.5px]"
            >
              <span className="text-text-muted">{k}</span>
              {account === undefined ? (
                <Skeleton className="h-[13px] w-40" />
              ) : (
                <span className="num text-text">{v ?? "—"}</span>
              )}
            </div>
          ))
        )}
      </Card>

      <div className="mt-8">
        <SectionHeading hint="One row per surface the copilot could answer on. A surface that is not connected is not broken — nobody has to have a Twitch app — so nothing here is red. eBay is the one that needs your consent on eBay's own page; the rest need a key on the server, a room, or nothing at all.">
          Connections
        </SectionHeading>
        <Card className="mt-3 divide-y divide-hairline">
          {connections === null ? (
            <div aria-busy="true" aria-label="reading your connections">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-[20px] w-24" />
                  <Skeleton className="h-[13px] w-64" />
                </div>
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="flex items-center gap-3 px-4 py-3 text-[12.5px] text-text-secondary">
              <span className="min-w-0 flex-1">
                Could not read your surfaces — the backend did not answer.
              </span>
              <Button size="sm" onClick={read}>
                <RefreshCw className="size-3" aria-hidden /> Retry
              </Button>
            </div>
          ) : (
            connections.map((row) => <ConnectionRow key={row.id} row={row} ebay={ebay} />)
          )}
        </Card>
      </div>

      <div className="mt-8">
        <SectionHeading hint="What is kept, and for how long, is listed under Settings → Account & data.">
          Session
        </SectionHeading>
        <Card className="mt-3 flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1 text-[12.5px] text-text-secondary">
            Signed in on this browser. Signing out forgets the session here only.
          </span>
          <Button
            size="sm"
            variant="danger"
            onClick={() => void logout().then(() => window.location.assign("/"))}
          >
            <LogOut className="size-3.5" aria-hidden /> Sign out
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}

/**
 * One surface's connection state, and the single place that changes it.
 *
 * The action is the first Before step that is not done, because that IS the
 * thing standing between this surface and a reply — for eBay that is the
 * consent page it has always been, for Reddit it is a key, for Twitch it is a
 * channel. A surface with nothing outstanding gets Manage, not a green tick
 * with nowhere to go.
 */
export function ConnectionRow({
  row,
  ebay,
}: {
  row: HomeSurfaceRow;
  ebay?: EbayStatus | null | undefined;
}) {
  const next = row.before.find((s) => !s.done) ?? null;
  const missing = missingLine(row);
  const detail =
    row.id === "ebaylive" && ebay?.write.connected
      ? "Markdowns, stock changes and ended listings can act on your real listings."
      : missing
        ? missing
        : next
          ? `${next.label} — ${row.during} once it is done.`
          : `${row.during} · ${row.after}`;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Badge tone={row.connected ? "ok" : "neutral"}>
        {row.connected ? "connected" : "not connected"}
      </Badge>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium">{row.label}</span>
        <span className="block text-[11.5px] leading-snug text-text-muted">{detail}</span>
      </span>
      {next?.href ? (
        <Link to={next.href as "/"} search={next.search ?? {}}>
          <Button size="sm">{next.cta ?? "Open"}</Button>
        </Link>
      ) : row.id === "ebaylive" ? (
        <Link to="/settings" search={{ tab: "ebay" }}>
          <Button size="sm">Manage</Button>
        </Link>
      ) : null}
    </div>
  );
}
