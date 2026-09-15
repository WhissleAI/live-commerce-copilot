/**
 * Who you are here, and what is kept.
 *
 * The rail's account button used to sign you out — a profile is what a person
 * expects from it. Signing out is a button on this page, said plainly.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { api, ensureSession, logout } from "@/lib/api";
import type { Account, EbayStatus } from "@/lib/types";
import { AppShell } from "@/components/app/AppShell";
import { Badge, Button, Card, SectionHeading } from "@/components/ui/kit";

export function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ebay, setEbay] = useState<EbayStatus | null>(null);
  useEffect(() => {
    void ensureSession().then(setAccount);
    void api.ebayStatus().then(setEbay).catch(() => setEbay(null));
  }, []);

  return (
    <AppShell section="account" title="Account" subtitle={account?.email ?? "your account"}>
      <SectionHeading hint="Every send, approval, eBay consent and deleted show is recorded against this account in the audit chain — which is the only way “who approved that markdown” has an answer.">
        You
      </SectionHeading>
      <Card className="mt-3 divide-y divide-hairline">
        {[
          ["Name", account?.displayName ?? "—"],
          ["Email", account?.email ?? "—"],
          ["Handle", account?.handle ?? "—"],
          ["Account id", account?.id ?? "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-[12.5px]">
            <span className="text-text-muted">{k}</span>
            <span className="num text-text">{v}</span>
          </div>
        ))}
      </Card>

      <div className="mt-8">
        <SectionHeading hint="Reading the catalog needs only the application; acting on your listings needs your consent on eBay's own page.">
          eBay
        </SectionHeading>
        <Card className="mt-3 flex items-center gap-3 px-4 py-3">
          <Badge tone={ebay?.write.connected ? "ok" : "neutral"}>
            {ebay ? (ebay.write.connected ? "connected" : "not connected") : "…"}
          </Badge>
          <span className="min-w-0 flex-1 text-[12.5px] text-text-secondary">
            {ebay?.write.connected
              ? "Markdowns, stock changes and ended listings can act on your real listings."
              : "Connect once so actions can reach your listings."}
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
          <Button size="sm" variant="danger" onClick={() => void logout().then(() => window.location.assign("/"))}>
            <LogOut className="size-3.5" aria-hidden /> Sign out
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
