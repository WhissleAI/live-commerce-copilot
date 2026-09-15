/**
 * Who you are here, and what is kept.
 *
 * The rail's account button used to sign you out — a profile is what a person
 * expects from it. Signing out is a button on this page, said plainly.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, RefreshCw } from "lucide-react";
import { api, ensureSession, logout } from "@/lib/api";
import type { Account, EbayStatus } from "@/lib/types";
import { AppShell } from "@/components/app/AppShell";
import { Badge, Button, Card, SectionHeading, Skeleton } from "@/components/ui/kit";

export function AccountPage() {
  // `undefined` is "not read yet", `null` is "the read failed" — so a failed
  // read shows a retry instead of dashes that look like an empty account.
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [ebay, setEbay] = useState<EbayStatus | null | undefined>(undefined);
  const read = () => {
    setAccount(undefined);
    setEbay(undefined);
    void ensureSession()
      .then((a) => setAccount(a ?? null))
      .catch(() => setAccount(null));
    void api
      .ebayStatus()
      .then(setEbay)
      .catch(() => setEbay(null));
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
        <SectionHeading hint="Reading the catalog needs only the application; acting on your listings needs your consent on eBay's own page.">
          eBay
        </SectionHeading>
        <Card className="mt-3 flex items-center gap-3 px-4 py-3">
          {ebay === undefined ? (
            <Skeleton className="h-[20px] w-24" />
          ) : (
            <Badge tone={ebay?.write.connected ? "ok" : "neutral"}>
              {ebay === null ? "unknown" : ebay.write.connected ? "connected" : "not connected"}
            </Badge>
          )}
          <span className="min-w-0 flex-1 text-[12.5px] text-text-secondary">
            {ebay === undefined ? (
              <Skeleton className="h-[13px] w-64" />
            ) : ebay === null ? (
              "eBay status did not load — open Settings → eBay to check."
            ) : ebay.write.connected ? (
              "Markdowns, stock changes and ended listings can act on your real listings."
            ) : (
              "Connect once so actions can reach your listings."
            )}
          </span>
          <Link to="/settings" search={{ tab: "ebay" }}>
            <Button size="sm">{ebay?.write.connected ? "Manage" : "Connect"}</Button>
          </Link>
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
