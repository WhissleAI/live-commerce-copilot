/**
 * The three settings tabs that had no surface at all.
 *
 * `Agent & ingestion` and `Automation` were env-only: changing what the copilot
 * may use, or where a show starts on the ladder, meant editing a `.env` and
 * restarting. Both are now fields on the seller's policy, honoured at the door
 * — turning host audio off makes the transcript route refuse, which makes the
 * copilot abstain on "last one in this waist" rather than guess at it.
 *
 * `Dry run` is the one that changes how a guardrail edit gets tested: same
 * pipeline, same six guards, against the catalog as it stands, and nothing is
 * sent. Previously a regex could only be tested on a live buyer.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { api, claimConsole, ensureSession } from "@/lib/api";
import { GUARD_ORDER } from "@/lib/format";
import type {
  DryRunResult,
  EbayImportResult,
  EbayStatus,
  PreparedShow,
  SellerGuardrailPolicy,
  ShowRow,
} from "@/lib/types";
import {
  Badge,
  BadgeButton,
  Button,
  Card,
  EmptyState,
  GuardPill,
  SectionHeading,
} from "@/components/ui/kit";

type Patch = <K extends keyof SellerGuardrailPolicy>(k: K, v: SellerGuardrailPolicy[K]) => void;

function Toggle({
  label,
  hint,
  on,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left shadow-[0_1px_0_var(--hairline)] last:shadow-none hover:bg-elevated/60 disabled:cursor-not-allowed"
    >
      <span className="min-w-0">
        <span className="block text-[12.5px]">{label}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">{hint}</span>
      </span>
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-hairline-strong"} ${disabled ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 size-3 rounded-full bg-panel transition-[left] ${on ? "left-3.5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function NumberField({
  label,
  hint,
  value,
  suffix,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-md bg-panel px-4 py-3 z1">
      <div className="text-[12.5px]">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="num w-24 rounded-sm bg-canvas px-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-[1.5px] focus:ring-accent"
        />
        {suffix ? <span className="text-[11.5px] text-text-muted">{suffix}</span> : null}
      </div>
      {hint ? <p className="mt-2 text-[11.5px] leading-snug text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function IngestionPanel({ p, set }: { p: SellerGuardrailPolicy; set: Patch }) {
  const ing = p.ingest;
  return (
    <>
      <SectionHeading hint="Each source off is one class of question the copilot will abstain on rather than guess at. The consequence is printed beside the switch, because that is the thing worth knowing before turning one off.">
        What the copilot may use
      </SectionHeading>
      <Card className="mt-3">
        <Toggle
          label="Buyer chat"
          hint="Required. Without it there is nothing to answer."
          on
          disabled
          onChange={() => {}}
        />
        <Toggle
          label="Host audio, with emotion and intent"
          hint="Off means it never hears “last one in this waist” — the lot facts you say out loud and never typed. On, the audio is kept in chunks beside its transcript so the show can be played back."
          on={ing.hostAudio}
          onChange={(v) => set("ingest", { ...ing, hostAudio: v })}
        />
        <Toggle
          label="Camera frames"
          hint="A frame every few seconds, used to name a placeholder lot and read a price card. The frames the agent reads are kept with their reading for the report's timeline."
          on={ing.cameraFrames}
          onChange={(v) => set("ingest", { ...ing, cameraFrames: v })}
        />
        <Toggle
          label="Sold comps and web research"
          hint="Powers the research card. Never grounds a reply on its own — a web page is not your listing."
          on={ing.webResearch}
          onChange={(v) => set("ingest", { ...ing, webResearch: v })}
        />
        <Toggle
          label="Prior shows' answered questions"
          hint="Reuses what you already answered well. Off if you would rather each show start clean."
          on={ing.priorAnswers}
          onChange={(v) => set("ingest", { ...ing, priorAnswers: v })}
        />
      </Card>
    </>
  );
}

export function AutomationPanel({ p, set }: { p: SellerGuardrailPolicy; set: Patch }) {
  const a = p.automation;
  const RUNGS: { id: SellerGuardrailPolicy["automation"]["startingRung"]; label: string }[] = [
    { id: "L0_OBSERVE", label: "L0 Observe" },
    { id: "L1_SUGGEST", label: "L1 Suggest" },
    { id: "L2_ONE_TAP", label: "L2 One-tap" },
    { id: "L3_AUTO_REPLY", label: "L3 Auto-reply" },
  ];
  return (
    <>
      <SectionHeading hint="Where a new show starts, and the bounds any rung above it must respect. Price and discount are excluded from auto-reply at every rung and cannot be added — they move during a show, and that is where a wrong answer costs real money.">
        Automation defaults
      </SectionHeading>

      <Card className="mt-3 px-4 py-3">
        <div className="text-[12.5px]">Start every show at</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {RUNGS.map((r) => (
            <BadgeButton
              key={r.id}
              tone={a.startingRung === r.id ? "accent" : "neutral"}
              onClick={() => set("automation", { ...a, startingRung: r.id })}
            >
              {r.label}
            </BadgeButton>
          ))}
          <Badge title="Bounded auto-acting needs a show that writes to eBay (Settings · eBay) and a rollback rate under 10% across five shows. Until both hold it stays locked.">
            L4 Auto-act · locked until a show writes to eBay
          </Badge>
        </div>
        <p className="mt-2.5 text-[11.5px] leading-snug text-text-muted">
          Rungs above L1 unlock from your own finished shows. Readiness is on Analytics.
        </p>
      </Card>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Confidence floor for auto-send"
          hint="A reply below this never sends itself, at any rung."
          value={a.confidenceFloor}
          min={0.5}
          max={0.99}
          step={0.01}
          onChange={(v) => set("automation", { ...a, confidenceFloor: v })}
        />
        <NumberField
          label="Undo window on committed actions"
          suffix="seconds"
          hint="How long a committed write stays one keystroke from undo."
          value={a.undoWindowS}
          min={10}
          max={600}
          step={5}
          onChange={(v) => set("automation", { ...a, undoWindowS: v })}
        />
        <NumberField
          label="Action budget per show"
          suffix="writes"
          hint="Spent, preflight refuses the next one."
          value={a.actionBudget}
          min={0}
          max={100}
          onChange={(v) => set("automation", { ...a, actionBudget: v })}
        />
        <NumberField
          label="Warn me when the balance falls below"
          suffix="USD"
          hint="Shown mid-show, in the one banner slot."
          value={a.warnBalanceUsd}
          min={0}
          max={1000}
          onChange={(v) => set("automation", { ...a, warnBalanceUsd: v })}
        />

        {/* A cap that stops the copilot has to be switchable off, and the
            "off" state has to be a real value the server understands — not a
            zero that reads as "stop immediately". */}
        <div className="rounded-md bg-panel px-4 py-3 z1">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[12.5px]">Stop drafting when a show has cost</span>
            <BadgeButton
              tone={a.perShowCapUsd == null ? "neutral" : "accent"}
              onClick={() =>
                set("automation", { ...a, perShowCapUsd: a.perShowCapUsd == null ? 5 : null })
              }
            >
              {a.perShowCapUsd == null ? "no cap" : "capped"}
            </BadgeButton>
          </div>
          {a.perShowCapUsd != null ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0.25}
                max={1000}
                step={0.25}
                value={a.perShowCapUsd}
                onChange={(e) =>
                  set("automation", { ...a, perShowCapUsd: Math.max(0.25, Number(e.target.value)) })
                }
                aria-label="Per-show spend cap in USD"
                className="num w-24 rounded-sm bg-canvas px-2 py-1.5 text-[12.5px] focus:outline-none focus:ring-[1.5px] focus:ring-accent"
              />
              <span className="text-[11.5px] text-text-muted">USD</span>
            </div>
          ) : null}
          <p className="mt-2 text-[11.5px] leading-snug text-text-muted">
            Spend is a wallet delta and the wallet is workspace-wide, so the figure is an upper
            bound — the cap fires early rather than late. Past it, questions still arrive and are
            recorded; nothing is drafted.
          </p>
        </div>
      </div>

      <Card className="mt-3 px-4 py-3">
        <div className="text-[12.5px] font-medium">Always needs a human, at every rung</div>
        <ul className="mt-2 flex flex-col gap-1.5 text-[12px] text-text-secondary">
          <li>· ending a listing</li>
          <li>· swapping the pinned lot</li>
          <li>· any reply a guard blocked</li>
        </ul>
        <p className="mt-2 text-[11.5px] leading-snug text-text-muted">
          The first two change what the show <em>is</em>; the third is not a warning to click
          through.
        </p>
      </Card>
    </>
  );
}

export function DryRunPanel() {
  const [q, setQ] = useState("is the 517 guaranteed authentic?");
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.dryRun(q));
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeading hint="Ask what the copilot would say, against the catalog exactly as it stands, without a show running and without sending anything. The same pipeline and the same six guards — which is how a guardrail change gets tested between shows rather than on a buyer.">
        Dry run
      </SectionHeading>

      <Card className="mt-3 px-4 py-3.5">
        <div className="flex gap-2.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            aria-label="A question to dry-run"
            className="min-w-0 flex-1 rounded-sm bg-canvas px-3 py-2 text-[12.5px] focus:outline-none focus:ring-[1.5px] focus:ring-accent"
          />
          <Button
            size="md"
            variant="primary"
            onClick={() => void run()}
            disabled={busy || !q.trim()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Run
          </Button>
        </div>

        {error ? <p className="mt-3 text-[12.5px] text-bad">{error}</p> : null}

        {result ? (
          <div className="mt-4">
            <p className="text-[14px] leading-snug">{result.answer}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {GUARD_ORDER.map((g) => {
                const hit = result.guards.find((x) => x.guard === g);
                return <GuardPill key={g} guard={g} verdict={hit?.verdict ?? "n/a"} />;
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge>{result.latencyMs}ms</Badge>
              <Badge>confidence {result.confidence.toFixed(2)}</Badge>
              <Badge tone={result.abstained ? "warn" : "neutral"}>
                {result.abstained
                  ? "abstained — nothing to ground it"
                  : `${result.evidence.length} facts cited`}
              </Badge>
            </div>
            <p className="mt-3 text-[11.5px] text-text-muted">
              Nothing was sent, queued or counted. This is the same path a buyer's question takes,
              stopped one step before the queue.
            </p>
          </div>
        ) : null}
      </Card>
    </>
  );
}

export function AgentsPanel({
  rows,
  prepared,
  onDelete,
  onDropPrepared,
}: {
  rows: ShowRow[] | null;
  /** Agents created ahead of a show. They live on the same Whissle key and
   *  were invisible here, which is how an account accumulates agents nobody
   *  can account for. */
  prepared: PreparedShow[];
  onDelete: (r: ShowRow) => void;
  onDropPrepared: (p: PreparedShow) => void;
}) {
  const withAgents = (rows ?? []).filter((r) => r.agentId);
  // A prepared show that has since been attached shows up in `rows` with the
  // same agent; list it once, as the session.
  const sessionAgents = new Set(withAgents.map((r) => r.agentId));
  const preparedOnly = prepared.filter((p) => p.agentId && !sessionAgents.has(p.agentId));
  return (
    <>
      <SectionHeading hint="Every stream gets its own Whissle agent, built from the same template and tuned to that show's lineup — the enrichment differs per show, and a shared agent would answer one show's question out of another show's stock. Deleting a session deletes its agent and its knowledge base with it.">
        Stream agents
      </SectionHeading>
      <Card className="mt-3 overflow-hidden">
        {rows === null ? (
          <div className="px-4 py-4 text-[12.5px] text-text-muted">reading…</div>
        ) : withAgents.length + preparedOnly.length === 0 ? (
          <EmptyState title="No stream agents yet">
            One is created when you attach to a show, and removed when you delete the session.
          </EmptyState>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11.5px] text-text-muted shadow-[0_1px_0_var(--hairline)]">
                <th className="px-4 py-2.5 font-medium">Show</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {preparedOnly.map((p) => (
                <tr key={`prep-${p.eventId}`} className="text-text-secondary even:bg-canvas/60">
                  <td className="max-w-[280px] truncate px-4 py-2.5 text-text">{p.title}</td>
                  <td className="num px-4 py-2.5">{p.agentId}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={p.items ? "accent" : "warn"}>prepared · {p.items} lots</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <BadgeButton tone="bad" onClick={() => onDropPrepared(p)}>
                      <Trash2 className="size-3" aria-hidden /> drop
                    </BadgeButton>
                  </td>
                </tr>
              ))}
              {withAgents.map((r) => (
                <tr key={r.showId} className="text-text-secondary even:bg-canvas/60">
                  <td className="max-w-[280px] truncate px-4 py-2.5 text-text">{r.title}</td>
                  <td className="num px-4 py-2.5">{r.agentId}</td>
                  <td className="px-4 py-2.5">
                    {r.status === "live" ? <Badge tone="bad">in use</Badge> : <Badge>idle</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status === "live" ? (
                      <span className="text-[11.5px] text-text-muted">in use</span>
                    ) : (
                      <BadgeButton tone="bad" onClick={() => onDelete(r)}>
                        <Trash2 className="size-3" aria-hidden /> delete
                      </BadgeButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

/**
 * eBay, split the way the capability actually splits.
 *
 * Reading and writing need different things and fail for different reasons, and
 * showing them as one "connected" light would be wrong in both directions: the
 * product can search eBay's catalog with nothing but an application key, and it
 * cannot touch a listing without the seller personally consenting in a browser.
 * So they are two rows, each saying what it can do and what is missing.
 *
 * The sold-price line is not an apology. It is the reason the research card
 * says "median asking price", and a seller who does not know the difference
 * between that and a sale price will misprice against it.
 */
export function EbayPanel() {
  const [status, setStatus] = useState<EbayStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<EbayImportResult | null>(null);

  const load = useCallback(async () => {
    setStatus(await api.ebayStatus().catch(() => null));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(what);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(null);
      void load();
    }
  }

  if (!status) {
    return (
      <>
        <SectionHeading>eBay</SectionHeading>
        <Card className="mt-3 px-4 py-3">
          <p className="text-[12.5px] text-text-muted">Reading the application status…</p>
        </Card>
      </>
    );
  }

  const w = status.write;

  return (
    <>
      <SectionHeading hint="Two capabilities, not one. Searching eBay and reading its catalog needs an application key; acting on your listings needs you to sign in and consent, and no key can stand in for that.">
        eBay
      </SectionHeading>

      {error ? (
        <Card tone="bad" className="mt-3 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span className="text-[12.5px] text-text">{error}</span>
        </Card>
      ) : null}

      {/* reading ---------------------------------------------------------- */}
      <Card className="mt-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-[12.5px] font-medium">Reading the catalog</span>
          <Badge>{status.env}</Badge>
          <Badge tone={status.browse && status.taxonomy ? "ok" : "bad"}>
            {status.browse && status.taxonomy ? "working" : "unavailable"}
          </Badge>
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-[12px] text-text-secondary">
          <li>
            <Badge tone={status.browse ? "ok" : "bad"}>Browse</Badge> live listings behind the
            research card&apos;s comparables
          </li>
          <li>
            <Badge tone={status.taxonomy ? "ok" : "bad"}>Taxonomy</Badge> the fields eBay requires
            per category, checked against your catalog on Setup
          </li>
          <li>
            <Badge tone={status.soldComps ? "ok" : "warn"}>Sold prices</Badge>{" "}
            {status.soldComps ? (
              <>
                what things actually went for, over the last 90 days — preferred over asking prices
                everywhere. Sandbox carries no sales history, so lookups there fall through to
                active listings and say so
              </>
            ) : (
              <>
                unavailable — comparables fall back to what sellers are <em>asking</em>, which runs
                higher than what things sell for
              </>
            )}
          </li>
        </ul>
        {status.error ? <p className="mt-2 text-[11.5px] text-bad">{status.error}</p> : null}
      </Card>

      {/* writing ---------------------------------------------------------- */}
      <Card className="mt-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-[12.5px] font-medium">Acting on your listings</span>
          <Badge tone={w.connected ? "ok" : "neutral"}>
            {w.connected ? "connected" : "not connected"}
          </Badge>
        </div>

        {w.blockers.length ? (
          <>
            <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
              Before a seller can be asked to consent, the application needs a registered redirect:
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {w.blockers.map((b) => (
                <li key={b} className="num text-[11.5px] leading-relaxed text-warn">
                  · {b}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
            {w.connected
              ? `Connected ${w.connectedAt ? new Date(w.connectedAt).toLocaleString() : ""}. Markdowns, stock changes and ended listings can now be armed per show — they still default to the mock until you switch a show over.`
              : "Sign in at eBay and approve inventory access. We ask for price, stock and listing scopes only — nothing that touches an order."}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {w.connected ? (
            <>
              <Button
                onClick={() =>
                  void run("import", async () => setImported(await api.ebayImport({ limit: 200 })))
                }
                disabled={busy !== null}
              >
                {busy === "import" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-3.5" aria-hidden />
                )}
                Import my listings as a catalog
              </Button>
              <Button
                variant="danger"
                onClick={() => void run("disconnect", () => api.ebayDisconnect())}
                disabled={busy !== null}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              disabled={busy !== null || w.blockers.length > 0}
              onClick={() =>
                void run("connect", async () => {
                  // Consent is recorded against an operator, not a guest. Claim
                  // the console on the way rather than sending the seller to
                  // find "Take control" on another tab.
                  const who = await ensureSession().catch(() => null);
                  if (!who || who.kind === "guest") await claimConsole();
                  const { url } = await api.ebayConnect();
                  window.open(url, "_blank", "noopener,noreferrer");
                })
              }
            >
              {busy === "connect" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <ExternalLink className="size-3.5" aria-hidden />
              )}
              Connect eBay
            </Button>
          )}
        </div>

        {imported ? (
          <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">
            Imported <span className="num text-text">{imported.items}</span> listings as{" "}
            <span className="num text-text">{imported.catalogId}</span>.
            {imported.skipped.length ? (
              <>
                {" "}
                <span className="num text-warn">{imported.skipped.length}</span> were skipped —{" "}
                {imported.skipped[0]!.why} — and are listed in the response rather than dropped
                quietly. Policies do not come across: eBay&apos;s are account settings, not the
                clause text a reply can cite, so add those before the next show.
              </>
            ) : null}
          </p>
        ) : null}
      </Card>
    </>
  );
}
