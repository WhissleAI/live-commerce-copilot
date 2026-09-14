import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Plus, RotateCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { api, ensureSession } from "@/lib/api";
import type { NeverSayRule, SellerGuardrailPolicy, SettingsView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConsoleButton } from "@/components/console/primitives";
import { PageShell, Section } from "./PageShell";

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
export function SettingsPage() {
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
      <PageShell title="Guardrails">
        <p className="text-[12px] text-text-muted">{error ?? "Loading the policy…"}</p>
      </PageShell>
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
    <PageShell
      title="Guardrails"
      subtitle={
        view.updatedAt
          ? `Last saved ${new Date(view.updatedAt).toLocaleString()}`
          : "Using the built-in defaults"
      }
      actions={
        <>
          <ConsoleButton variant="secondary" onClick={reset} disabled={busy}>
            <RotateCcw className="size-3" aria-hidden /> reset
          </ConsoleButton>
          <ConsoleButton variant="primary" onClick={save} disabled={busy || !dirty}>
            <Save className="size-3" aria-hidden /> {busy ? "saving…" : dirty ? "save" : "saved"}
          </ConsoleButton>
        </>
      }
    >
      {error ? (
        <div className="mb-6 flex items-start gap-2 rounded-[6px] border border-bad/40 bg-bad/5 px-3 py-2">
          <AlertTriangle className="mt-[2px] size-3.5 shrink-0 text-bad" aria-hidden />
          <p className="text-[12px] leading-relaxed text-text">{error}</p>
        </div>
      ) : null}

      {/* What the gateway ACTUALLY has, read back after the push. */}
      {view.armed ? (
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
              <span className="num text-[10px] text-text-muted">{view.armed.agentId.slice(0, 8)}</span>
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
                  onClick={() => set("neverSay", draft.neverSay.filter((_, j) => j !== i))}
                  aria-label={`remove rule ${i + 1}`}
                  className="rounded-[3px] p-1 text-text-muted hover:text-bad"
                >
                  <Trash2 className="size-3" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <ConsoleButton
          className="mt-2"
          variant="secondary"
          onClick={() => set("neverSay", [...draft.neverSay, { pattern: "", why: "" }])}
        >
          <Plus className="size-3" aria-hidden /> add a rule
        </ConsoleButton>
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

      <Section title="Voice" hint="Pushed to the agent, so they hold on every channel it answers.">
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
          <Toggle label="Allow emoji" on={draft.allowEmoji} onChange={(v) => set("allowEmoji", v)} />
        </div>
        <label className="mt-3 block">
          <span className="text-[11px] text-text-secondary">What the agent says instead when a rule fires</span>
          <input
            value={draft.onViolation}
            onChange={(e) => set("onViolation", e.target.value)}
            className="mt-1 w-full rounded-[3px] border border-hairline-strong bg-canvas px-2 py-1.5 text-[12px] text-text outline-none focus:border-accent"
          />
        </label>
      </Section>

      {savedAt ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ok">
          <Check className="size-3" aria-hidden />
          Saved. The next reply drafted is checked against this.
        </p>
      ) : null}
    </PageShell>
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
