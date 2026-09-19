import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Plus, RotateCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { api, ensureSession } from "@/lib/api";
import type {
  Account,
  NeverSayRule,
  PreparedShow,
  SellerGuardrailPolicy,
  SettingsView,
  ShowRow,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { Section } from "./PageShell";
import { AppShell, type Tab } from "@/components/app/AppShell";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui/kit";
import {
  IngestionPanel,
  AutomationPanel,
  DryRunPanel,
  AgentsPanel,
  EbayPanel,
} from "./SettingsPanels";
import { DeleteShowDialog } from "@/components/app/DeleteShowDialog";

/**
 * The guardrail policy, editable.
 *
 * This is the only settings surface worth building first, because it is the one
 * where a change is VISIBLE: the never-say list and the discount cap are read by
 * the guards on the very next reply, and pushed onto the Whissle agent so the
 * same rule holds on voice and on the embed widget where this app is not in the
 * loop at all.
 *
 * The page therefore does two things a normal form does not:
 *
 *  - it shows what the GATEWAY says is armed after a save, read back rather
 *    than assumed. Pushing config and trusting it took is how you end up
 *    believing in a guardrail that is not there.
 *  - it shows the asymmetry honestly. Rules marked `unlessCertified` are
 *    deliberately not pushed, because the gateway matcher has no catalog access
 *    and would blanket-block a phrase that is TRUE for a certified listing.
 */
export const SETTINGS_TABS = ["agent", "guardrails", "automation", "ebay", "data"] as const;
const TABS = SETTINGS_TABS;
export type SettingsTab = (typeof TABS)[number];
const TAB_LABEL: Record<SettingsTab, string> = {
  agent: "Agent & ingestion",
  guardrails: "Guardrails",
  automation: "Automation",
  ebay: "eBay",
  data: "Account & data",
};

export function SettingsPage({ initialTab }: { initialTab?: SettingsTab | undefined }) {
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "guardrails");
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [rows, setRows] = useState<ShowRow[] | null>(null);
  const [prepared, setPrepared] = useState<PreparedShow[]>([]);
  const readPrepared = useCallback(
    () =>
      api
        .home()
        .then((h) => setPrepared(h.prepared))
        .catch(() => setPrepared([])),
    [],
  );
  useEffect(() => {
    void readPrepared();
  }, [readPrepared]);
  const [deleting, setDeleting] = useState<ShowRow | null>(null);
  const [view, setView] = useState<SettingsView | null>(null);
  const [draft, setDraft] = useState<SellerGuardrailPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    await ensureSession().catch(() => null);
    const v = await api.settings();
    setView(v);
    setDraft(structuredClone(v.policy));
  }, []);

  useEffect(() => {
    void load().catch((e: Error) => setError(e.message));
    // The agents tab lists what this app created, which is a property of the
    // shows rather than of the policy.
    void api
      .reports(50)
      .then(setRows)
      .catch(() => setRows([]));
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const v = await api.saveSettings(draft);
      setView(v);
      setDraft(structuredClone(v.policy));
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await api.resetSettings();
      setView(v);
      setDraft(structuredClone(v.policy));
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!draft || !view) {
    return (
      <AppShell
        section="settings"
        title="Settings"
        subtitle={error ? undefined : "reading the policy…"}
      >
        {error ? (
          <Card tone="bad" className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 text-[12.5px]">{error}</span>
            <Button size="sm" onClick={() => void load().catch((e: Error) => setError(e.message))}>
              Retry
            </Button>
          </Card>
        ) : (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="reading the policy">
            <Skeleton className="h-[34px] w-2/3" />
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[80px] w-1/2" />
          </div>
        )}
      </AppShell>
    );
  }

  const set = <K extends keyof SellerGuardrailPolicy>(k: K, v: SellerGuardrailPolicy[K]) =>
    setDraft({ ...draft, [k]: v });

  const setRule = (i: number, patch: Partial<NeverSayRule>) => {
    const next = [...draft.neverSay];
    const cur = next[i];
    if (!cur) return;
    next[i] = { ...cur, ...patch };
    set("neverSay", next);
  };

  const pushed = draft.neverSay.filter((r) => !r.unlessCertified).length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(view.policy);

  return (
    <AppShell
      section="settings"
      title="Settings"
      subtitle={
        view.updatedAt
          ? `${TAB_LABEL[tab]} · last saved ${new Date(view.updatedAt).toLocaleString()}`
          : `${TAB_LABEL[tab]} · using the built-in defaults`
      }
      tabs={TABS.map((t) => ({ label: TAB_LABEL[t], active: tab === t, onClick: () => setTab(t) }))}
      actions={
        <>
          <Button onClick={reset} disabled={busy}>
            <RotateCcw className="size-3" aria-hidden /> Reset
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !dirty}>
            <Save className="size-3" aria-hidden /> {busy ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </>
      }
    >
      {error ? (
        <div className="mb-6 flex items-start gap-2 rounded-[6px] border border-bad/40 bg-bad/5 px-3 py-2">
          <AlertTriangle className="mt-[2px] size-3.5 shrink-0 text-bad" aria-hidden />
          <p className="text-[12px] leading-relaxed text-text">{error}</p>
        </div>
      ) : null}

      {tab === "agent" ? (
        <>
          <AgentsPanel
            rows={rows}
            prepared={prepared}
            onDelete={setDeleting}
            onDropPrepared={(p) => void api.dropPrepared(p.eventId).then(readPrepared)}
          />
          <div className="mt-8">
            <IngestionPanel p={draft} set={set} />
          </div>
        </>
      ) : null}

      {tab === "automation" ? (
        <>
          <AutomationPanel p={draft} set={set} />
          <div className="mt-8">
            <DryRunPanel />
          </div>
        </>
      ) : null}

      {tab === "ebay" ? <EbayPanel /> : null}

      {tab === "data" ? <AccountAndData /> : null}

      {/* What the gateway ACTUALLY has, read back after the push. */}
      {tab === "guardrails" && view.armed ? (
        <div
          className={cn(
            "mb-8 rounded-[6px] border px-3 py-2.5",
            view.armed.ok ? "border-ok/40 bg-ok/5" : "border-warn/50 bg-warn/5",
          )}
        >
          <div className="flex items-center gap-2">
            {view.armed.ok ? (
              <ShieldCheck className="size-3.5 text-ok" aria-hidden />
            ) : (
              <AlertTriangle className="size-3.5 text-warn" aria-hidden />
            )}
            <span className="text-[12px] font-medium text-text">
              {view.armed.ok ? "Armed on the Whissle agent" : "Saved here, NOT armed on the agent"}
            </span>
            {view.armed.agentId ? (
              <span className="num text-[10px] text-text-muted">
                {view.armed.agentId.slice(0, 8)}
              </span>
            ) : null}
          </div>
          {view.armed.error ? (
            <p className="mt-1 text-[11px] leading-relaxed text-warn">{view.armed.error}</p>
          ) : null}
          {view.armed.items.length ? (
            <dl className="mt-2 space-y-0.5">
              {view.armed.items.map((it) => (
                <div key={it.label} className="flex items-baseline gap-2 text-[11px]">
                  <dt className="shrink-0 text-text-muted">{it.label}</dt>
                  <dd className="num truncate text-text-secondary">{JSON.stringify(it.value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
            Read back from the gateway after the push, not assumed from it. This is what fires on
            voice and on the embed widget, where this app is not in the loop.
          </p>
        </div>
      ) : null}

      {tab === "guardrails" ? (
        <>
          <GuardChain />

          <Section
            title="Never say"
            hint={`Blocked outright, in both layers. ${pushed} of ${draft.neverSay.length} are pushed to the agent — rules marked “unless certified” stay here, because the gateway matcher has no catalog access and would block the phrase even on a listing that genuinely carries a certificate.`}
          >
            <ul className="space-y-1.5">
              {draft.neverSay.map((r, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-[5px] border border-hairline bg-panel px-2 py-1.5"
                >
                  <input
                    value={r.pattern}
                    onChange={(e) => setRule(i, { pattern: e.target.value })}
                    spellCheck={false}
                    className="num min-w-0 rounded-[3px] border border-transparent bg-transparent px-1.5 py-1 text-[12px] text-text outline-none focus:border-accent"
                    aria-label={`pattern ${i + 1}`}
                  />
                  <input
                    value={r.why}
                    onChange={(e) => setRule(i, { why: e.target.value })}
                    placeholder="why this is blocked"
                    className="min-w-0 rounded-[3px] border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-text-secondary outline-none focus:border-accent"
                    aria-label={`reason ${i + 1}`}
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRule(i, { regex: !r.regex })}
                      title="Treat this pattern as a regular expression"
                      className={cn(
                        "rounded-[3px] border px-1.5 py-0.5 text-[10px]",
                        r.regex
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-hairline-strong text-text-muted hover:text-text",
                      )}
                    >
                      regex
                    </button>
                    {r.unlessCertified ? (
                      <span
                        title="Not pushed to the agent — only checked here, where the listing's certificate is in hand"
                        className="rounded-[3px] border border-hairline-strong px-1.5 py-0.5 text-[10px] text-text-muted"
                      >
                        app-only
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "neverSay",
                          draft.neverSay.filter((_, j) => j !== i),
                        )
                      }
                      aria-label={`remove rule ${i + 1}`}
                      className="rounded-[3px] p-1 text-text-muted hover:text-bad"
                    >
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              className="mt-2"
              onClick={() => set("neverSay", [...draft.neverSay, { pattern: "", why: "" }])}
            >
              <Plus className="size-3" aria-hidden /> Add a rule
            </Button>
          </Section>

          <Section
            title="Limits"
            hint="Checked against live catalog state, so these cannot be expressed as a phrase and are never pushed to the agent."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Max discount on air"
                hint="A markdown beyond this fails preflight and can never be committed."
                suffix="%"
              >
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={draft.maxDiscountPct}
                  onChange={(e) => set("maxDiscountPct", Number(e.target.value))}
                  className="num w-20 rounded-[3px] border border-hairline-strong bg-canvas px-2 py-1 text-[12px] text-text outline-none focus:border-accent"
                />
              </Field>
              <Field label="Max reply length" hint="Live chat replies stay short." suffix="chars">
                <input
                  type="number"
                  min={80}
                  max={2000}
                  value={draft.maxReplyChars}
                  onChange={(e) => set("maxReplyChars", Number(e.target.value))}
                  className="num w-24 rounded-[3px] border border-hairline-strong bg-canvas px-2 py-1 text-[12px] text-text outline-none focus:border-accent"
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Voice"
            hint="Pushed to the agent, so they hold on every channel it answers."
          >
            <div className="space-y-1.5">
              <Toggle
                label="Redact PII in the live reply"
                hint="Masks e-mail, phone, card-like runs before anything reaches public chat."
                on={draft.redactPii}
                onChange={(v) => set("redactPii", v)}
              />
              <Toggle
                label="Allow markdown"
                on={draft.allowMarkdown}
                onChange={(v) => set("allowMarkdown", v)}
                hint="Marketplace chat renders it literally."
              />
              <Toggle
                label="Allow emoji"
                on={draft.allowEmoji}
                onChange={(v) => set("allowEmoji", v)}
              />
            </div>
            <label className="mt-3 block">
              <span className="text-[11px] text-text-secondary">
                What the agent says instead when a rule fires
              </span>
              <input
                value={draft.onViolation}
                onChange={(e) => set("onViolation", e.target.value)}
                className="mt-1 w-full rounded-[3px] border border-hairline-strong bg-canvas px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent"
              />
            </label>
          </Section>
        </>
      ) : null}

      {savedAt ? (
        <p className="flex items-center gap-2 text-[12px] text-ok">
          <Check className="size-3" aria-hidden />
          Saved, re-pushed, and read back. The next reply drafted is checked against this.
        </p>
      ) : null}

      {deleting ? (
        <DeleteShowDialog
          row={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            void api
              .reports(50)
              .then(setRows)
              .catch(() => setRows([]));
          }}
        />
      ) : null}
    </AppShell>
  );
}

/**
 * What runs on every reply, whether or not you configure anything.
 *
 * The settings page could edit two of the six guards and said nothing about the
 * other four, so a seller reading it would reasonably conclude those were all
 * the checks there are. Four of them have no knob BY DESIGN — a price guard
 * with a tolerance setting is a price guard you can turn off — and saying that
 * out loud is worth more than a switch.
 */
function GuardChain() {
  const guards: { name: string; checks: string; knob: string | null }[] = [
    {
      name: "Price",
      checks:
        "Every number in the draft matches the current listing version, or an approved markdown. A reply drafted before a price change is caught here.",
      knob: null,
    },
    {
      name: "Availability",
      checks: "Nothing is promised that is sold out or already committed to another buyer.",
      knob: null,
    },
    {
      name: "Policy",
      checks:
        "Shipping, returns, authenticity and the discount floor — plus every rule in Never say below.",
      knob: "Never say · Max discount on air",
    },
    {
      name: "Grounding",
      checks:
        "Every claim cites a real fact id whose text supports it. No citation, no send — the copilot abstains instead of guessing.",
      knob: "Automation · confidence floor",
    },
    {
      name: "Tone",
      checks: "Length, markdown, emoji and the voice you set for the agent.",
      knob: "Voice",
    },
    {
      name: "PII",
      checks: "E-mail, phone and card-like runs are masked before anything reaches public chat.",
      knob: "Voice · redact PII",
    },
  ];

  return (
    <Section
      title="What always runs"
      hint="Six deterministic checks on every drafted reply, in this order. A block is never a model's opinion — it is one of these failing, and the console names which."
    >
      <Card className="divide-y divide-hairline">
        {guards.map((g) => (
          <div key={g.name} className="flex gap-3 px-3.5 py-2.5">
            <span className="w-[92px] shrink-0 text-[12.5px] font-medium">{g.name}</span>
            <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-text-secondary">
              {g.checks}
            </p>
            <span className="hidden w-[168px] shrink-0 text-right text-[11.5px] text-text-muted sm:block">
              {g.knob ?? "no setting — by design"}
            </span>
          </div>
        ))}
      </Card>
    </Section>
  );
}

function Field({
  label,
  hint,
  suffix,
  children,
}: {
  label: string;
  hint?: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[6px] border border-hairline bg-panel px-3 py-2.5">
      <div className="text-[11px] text-text">{label}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {children}
        {suffix ? <span className="text-[11px] text-text-muted">{suffix}</span> : null}
      </div>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-text-muted">{hint}</p> : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 rounded-[6px] border border-hairline bg-panel px-3 py-2 text-left hover:border-hairline-strong"
    >
      <span className="min-w-0">
        <span className="block text-[11px] text-text">{label}</span>
        {hint ? <span className="block text-[10px] text-text-muted">{hint}</span> : null}
      </span>
      <span
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          on ? "bg-accent" : "bg-hairline-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-canvas transition-[left]",
            on ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

/**
 * Who you are, and what is kept.
 *
 * Every screen assumes a guest who can watch and cannot send, and the audit
 * chain records approvals against an account — so this is the one place that
 * says what taking control actually means, and how long anything survives.
 */
function AccountAndData() {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    void ensureSession()
      .then(setAccount)
      .catch(() => setAccount(null));
  }, []);

  return (
    <>
      <Section
        title="Account"
        hint="Every send and approval is recorded against the signed-in account in the audit chain — which is the only way “who approved that markdown” has an answer."
      >
        <Card className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Badge tone="ok">operator</Badge>
            <span className="text-[12.5px]">{account?.displayName ?? "No session"}</span>
            {account?.email ? (
              <span className="text-[12px] text-text-muted">{account.email}</span>
            ) : null}
          </div>
        </Card>
      </Section>

      <Section title="What is kept, and for how long">
        <Card>
          {[
            ["chat, proposals and their verdicts", "until you delete the session"],
            ["the hash-chained audit log", "kept with the session"],
            [
              "host audio",
              "10-second chunks on the server's disk, with the transcript and its emotion and intent distributions — playable from the report",
            ],
            [
              "camera frames",
              "the frames the agent read, kept with what it read; frames it skipped are not",
            ],
            ["the agent's conclusion and the platform's session summary", "kept in the report"],
            ["the stream's Whissle agent", "deleted with the session"],
            ["everything above", "deleted together when you delete the session — rows and bytes"],
          ].map(([what, howLong]) => (
            <div
              key={what}
              className="flex justify-between gap-4 px-4 py-2.5 text-[12.5px] shadow-[0_1px_0_var(--hairline)] last:shadow-none"
            >
              <span className="text-text-secondary">{what}</span>
              <span className="num text-text">{howLong}</span>
            </div>
          ))}
        </Card>
      </Section>
    </>
  );
}
