import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Link as LinkIcon, Loader2, Pin, Tag, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, formatMoney, formatMoneyShort } from "@/lib/format";
import type { ActionProposal, AuditEntry, Listing } from "@/lib/types";
import { ConsoleButton, Hover, SectionHeader } from "./primitives";
import { useNow } from "@/hooks/useNow";

function PinnedLot({
  listing,
  queue,
  flashedAt,
}: {
  listing: Listing | null;
  queue: Listing[];
  flashedAt: number | undefined;
}) {
  const flashing = flashedAt !== undefined && Date.now() - flashedAt < 1200;
  if (!listing) return <div className="p-3 text-[12px] text-text-muted">No lot pinned.</div>;
  return (
    <div className="shrink-0 border-b border-hairline">
      <SectionHeader title="Pinned lot">
        <span className="num text-[11px] text-text-muted">v{listing.version}</span>
      </SectionHeader>
      <div className="flex gap-3 p-3">
        {/* A lot observed on a live stream has no image of its own — eBay renders
            it in video, not as a listing photo. Show a placeholder rather than a
            broken image icon. */}
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            loading="lazy"
            className="size-16 shrink-0 rounded-[4px] border border-hairline object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-[4px] border border-hairline bg-elevated text-text-muted"
          >
            <Tag className="size-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <Pin className="mt-0.5 size-3 shrink-0 text-accent" aria-hidden />
            <p className="text-[12px] leading-snug font-medium text-text">{listing.title}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {listing.size ? (
              <span className="rounded-[4px] border border-hairline-strong px-1.5 text-[10px] text-text-secondary">
                size {listing.size}
              </span>
            ) : null}
            <span className="rounded-[4px] border border-hairline-strong px-1.5 text-[10px] text-text-secondary">
              {listing.condition}
            </span>
            {listing.authenticated ? (
              <span className="num rounded-[4px] border border-ok/40 px-1.5 text-[10px] text-ok">
                {listing.certId}
              </span>
            ) : null}
          </div>
          <div
            className={cn(
              "num mt-1.5 rounded-[3px] text-[20px] leading-none text-text",
              flashing && "anim-flash",
            )}
          >
            {formatMoney(listing.priceCents)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-hairline px-3 py-1.5 text-[11px] text-text-muted">
        <span>
          stock <span className="num text-text-secondary">{listing.qty}</span>
        </span>
        <span>
          sold <span className="num text-text-secondary">{listing.soldThisShow}</span>
        </span>
        <span>
          views <span className="num text-text-secondary">{listing.views}</span>
        </span>
      </div>
      <div className="flex gap-1.5 border-t border-hairline px-3 py-2">
        {queue.slice(0, 4).map((l) => (
          <Hover
            key={l.id}
            panelClassName="w-56"
            content={<span className="text-text">{l.title}</span>}
          >
            <span tabIndex={0} className="block w-14 shrink-0">
              <img
                src={l.imageUrl || undefined}
                alt={l.title}
                loading="lazy"
                className="h-10 w-14 rounded-[3px] border border-hairline object-cover"
              />
              <span className="num mt-0.5 block text-[10px] text-text-secondary">
                {formatMoneyShort(l.priceCents)}
              </span>
            </span>
          </Hover>
        ))}
      </div>
    </div>
  );
}

function ActionCard({
  a,
  onApprove,
  onReject,
  onRollback,
  now,
}: {
  a: ActionProposal;
  onApprove: () => void;
  onReject: () => void;
  onRollback: () => void;
  now: number;
}) {
  const failedPreflight = !a.preflight.ok;
  const undoLeft = a.undoableUntil
    ? Math.max(0, Math.round((new Date(a.undoableUntil).getTime() - now) / 1000))
    : 0;
  return (
    <li
      className={cn(
        "anim-in rounded-md border p-2.5",
        failedPreflight || a.status === "preflight_failed"
          ? "border-bad/40 bg-bad/6"
          : a.status === "committed"
            ? "border-ok/35 bg-ok/6"
            : a.status === "failed"
              ? "border-bad/45 bg-bad/8"
              : a.status === "rolled_back" || a.status === "rejected"
                ? "border-hairline bg-panel opacity-60"
                : "border-hairline bg-panel",
      )}
    >
      <div className="flex items-start gap-2">
        <Tag className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden />
        <p
          className={cn(
            "text-[12px] leading-snug text-text",
            (a.status === "rolled_back" || a.status === "rejected") && "line-through",
          )}
        >
          {a.summary}
        </p>
      </div>
      <p className="mt-1 pl-5 text-[11px] text-text-muted">{a.rationale}</p>

      <ul className="mt-1.5 space-y-0.5 pl-5">
        {a.preflight.checks.map((c) => (
          <li
            key={c.name}
            className={cn(
              "flex items-center gap-1.5 text-[11px]",
              c.ok ? "text-text-secondary" : "text-bad",
            )}
          >
            {c.ok ? (
              <Check className="size-3 shrink-0 text-ok" aria-hidden />
            ) : (
              <X className="size-3 shrink-0" aria-hidden />
            )}
            <span>{c.name}</span>
            <span className="num text-text-muted">({c.detail})</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-1.5 pl-5">
        {a.status === "proposed" && a.preflight.ok ? (
          <>
            <ConsoleButton variant="primary" className="h-6" onClick={onApprove}>
              Approve
            </ConsoleButton>
            <ConsoleButton variant="ghost" className="h-6" onClick={onReject}>
              Reject
            </ConsoleButton>
          </>
        ) : null}
        {a.status === "preflight_failed" ? (
          <span className="flex items-center gap-1 text-[11px] text-bad">
            <AlertTriangle className="size-3" aria-hidden /> preflight failed — approval withheld
          </span>
        ) : null}
        {a.status === "committing" ? (
          <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <Loader2 className="size-3 animate-spin" aria-hidden /> committing…
          </span>
        ) : null}
        {a.status === "committed" ? (
          <>
            <span className="flex items-center gap-1 text-[11px] text-ok">
              <Check className="size-3" aria-hidden /> committed
            </span>
            {undoLeft > 0 ? (
              <ConsoleButton variant="secondary" className="h-6" onClick={onRollback}>
                <Undo2 className="size-3" aria-hidden /> Undo ·{" "}
                <span className="num">{undoLeft}s</span>
              </ConsoleButton>
            ) : (
              <span className="text-[11px] text-text-muted">undo window closed</span>
            )}
          </>
        ) : null}
        {a.status === "failed" ? (
          <>
            <span className="text-[11px] text-bad">{a.error ?? "commit failed"}</span>
            <ConsoleButton variant="secondary" className="h-6" onClick={onApprove}>
              Retry
            </ConsoleButton>
          </>
        ) : null}
        {a.status === "rolled_back" ? (
          <span className="text-[11px] text-text-muted">rolled back</span>
        ) : null}
        {a.status === "rejected" ? (
          <span className="text-[11px] text-text-muted">rejected</span>
        ) : null}
        <span className="num ml-auto text-[10px] text-text-muted">
          {a.idempotencyKey.slice(0, 14)}…
        </span>
      </div>
    </li>
  );
}

function AuditRow({ e }: { e: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const tone =
    e.kind === "action_committed" || e.kind === "reply_sent"
      ? "text-ok"
      : e.kind === "action_rolled_back"
        ? "text-warn"
        : e.kind === "action_failed" ||
            e.kind === "reply_blocked" ||
            e.kind === "action_preflight_failed"
          ? "text-bad"
          : "text-text-secondary";
  return (
    <li className="border-b border-hairline/60">
      <Hover
        className="block w-full"
        side="top"
        panelClassName="w-80"
        content={
          <div className="num space-y-0.5 text-[11px]">
            <div>
              hash <span className="text-text">{e.hash}</span>
            </div>
            <div>
              prev <span className="text-text-muted">{e.prevHash}</span>
            </div>
          </div>
        }
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-elevated/60"
        >
          <span className="num shrink-0 text-[10px] text-text-muted">{formatClock(e.at)}</span>
          <span className="shrink-0 rounded-[3px] border border-hairline-strong px-1 text-[10px] text-text-muted">
            {e.actorType}
          </span>
          <span className={cn("min-w-0 flex-1 truncate text-[11px]", tone)}>{e.summary}</span>
        </button>
      </Hover>
      {open ? (
        <pre className="num overflow-x-auto border-t border-hairline bg-canvas px-3 py-1.5 text-[10px] text-text-secondary">
          {JSON.stringify(e.detail, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}

export function ShowRail({
  pinned,
  queue,
  flashed,
  actions,
  audit,
  onApprove,
  onReject,
  onRollback,
}: {
  pinned: Listing | null;
  queue: Listing[];
  flashed: Record<string, number>;
  actions: ActionProposal[];
  audit: AuditEntry[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRollback: (id: string) => void;
}) {
  const now = useNow();
  const [verify, setVerify] = useState<{ ok: boolean; message: string } | null>(null);
  const pendingCount = actions.filter((a) => a.status === "proposed" && a.preflight.ok).length;
  const ordered = [...audit].sort((a, b) => b.seq - a.seq);

  const verifyChain = useCallback(() => {
    const chain = [...audit].sort((a, b) => a.seq - b.seq);
    for (let i = 1; i < chain.length; i++) {
      if (chain[i]!.prevHash !== chain[i - 1]!.hash) {
        setVerify({ ok: false, message: `mismatch at seq ${chain[i]!.seq}` });
        return;
      }
    }
    setVerify({ ok: true, message: `chain intact (${chain.length} entries)` });
  }, [audit]);

  useEffect(() => {
    const handler = () => verifyChain();
    window.addEventListener("sidestage:verify-chain", handler);
    return () => window.removeEventListener("sidestage:verify-chain", handler);
  }, [verifyChain]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-hairline bg-panel">
      <PinnedLot
        listing={pinned}
        queue={queue}
        flashedAt={pinned ? flashed[pinned.id] : undefined}
      />

      <div className="flex min-h-0 flex-[1.2] flex-col border-b border-hairline">
        <SectionHeader title="Actions">
          <span className="num text-[11px] text-text-secondary">{pendingCount} pending</span>
        </SectionHeader>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          <div aria-live="polite" className="sr-only">
            {pendingCount} action proposals pending approval
          </div>
          {actions.length === 0 ? (
            <p className="p-2 text-[12px] text-text-muted">No action proposals.</p>
          ) : (
            <ul className="space-y-2">
              {actions.map((a) => (
                <ActionCard
                  key={a.id}
                  a={a}
                  now={now}
                  onApprove={() => onApprove(a.id)}
                  onReject={() => onReject(a.id)}
                  onRollback={() => onRollback(a.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <SectionHeader title="Audit">
          <span className="flex items-center gap-1 text-[11px] text-text-muted">
            <LinkIcon className="size-3" aria-hidden />
            <span className="num">h{audit.length ? audit[audit.length - 1]!.seq : 0}</span>
          </span>
          <ConsoleButton variant="ghost" className="h-6" onClick={verifyChain}>
            Verify chain
          </ConsoleButton>
        </SectionHeader>
        {verify ? (
          <p
            className={cn(
              "flex items-center gap-1 px-3 py-1 text-[11px]",
              verify.ok ? "text-ok" : "text-bad",
            )}
          >
            {verify.ok ? (
              <Check className="size-3" aria-hidden />
            ) : (
              <AlertTriangle className="size-3" aria-hidden />
            )}
            {verify.message}
          </p>
        ) : null}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <ul>
            {ordered.map((e) => (
              <AuditRow key={e.seq} e={e} />
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
