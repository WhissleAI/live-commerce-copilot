/**
 * One panel for every "tell me more".
 *
 * The evidence chip had a hover card, the guard pill had a different hover
 * card, the audit row had a title attribute and the latency number had nothing
 * at all — four ways to ask the same question, none of which could be read
 * next to another. A hover is a peek; it cannot hold the whole story of a
 * reply, and it disappears the moment you try to compare two parts of it.
 *
 * So the peek stays where it is and the whole story comes here: one right-dock
 * panel showing everything behind one object. Two subjects so far, because two
 * are what the console has to explain — a reply the copilot drafted, and an
 * entry in the chain.
 */

import {
  AlertTriangle,
  Check,
  CircleSlash,
  Clock,
  FileText,
  Hash,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/format";
import type { AuditEntry, Evidence, GuardResult, ReplyProposal } from "@/lib/types";
import { Badge, SectionLabel } from "@/components/ui/kit";

export type InspectorSubject = { kind: "proposal"; id: string } | { kind: "audit"; seq: number };

// Keyed by GuardName as the server sends it. The old keys (stock, grounding)
// were the console's pill labels, so the inspector printed raw snake_case.
const GUARD_LABEL: Record<string, string> = {
  price: "Price",
  availability: "Availability",
  stock: "Availability",
  policy: "Policy",
  claim_grounding: "Grounding",
  grounding: "Grounding",
  tone: "Tone",
  pii: "PII",
  community_rule: "Room rules",
  sponsor: "Sponsor",
};

const SOURCE_LABEL: Record<Evidence["source"], string> = {
  listing: "listing field",
  policy: "policy clause",
  catalog: "catalog record",
  qa: "prior answer",
  host: "what the host said on air",
  market: "market comp",
  // Never grounding. A style reference says how the operator has answered a
  // question like this before, which is a fact about their voice and not about
  // the thing being asked.
  persona: "how you answered this before",
};

export function Inspector({
  subject,
  proposals,
  audit,
}: {
  subject: InspectorSubject;
  proposals: ReplyProposal[];
  audit: AuditEntry[];
}) {
  if (subject.kind === "audit") {
    const entry = audit.find((a) => a.seq === subject.seq);
    return entry ? <AuditDetail entry={entry} /> : <Gone what="entry" />;
  }
  const p = proposals.find((x) => x.id === subject.id);
  return p ? <ProposalDetail p={p} audit={audit} /> : <Gone what="reply" />;
}

function Gone({ what }: { what: string }) {
  return (
    <p className="text-[12.5px] text-text-muted">
      That {what} is no longer in this console&apos;s window. The report keeps the whole show.
    </p>
  );
}

function ProposalDetail({ p, audit }: { p: ReplyProposal; audit: AuditEntry[] }) {
  const blocked = p.verdict === "block";
  const related = audit.filter((a) => (a.detail as { proposalId?: string }).proposalId === p.id);

  return (
    <div className="flex flex-col gap-5">
      {/* what was asked ---------------------------------------------------- */}
      <section>
        <SectionLabel>The question</SectionLabel>
        <p className="mt-1.5 flex items-start gap-2 text-[12.5px] leading-relaxed">
          <Quote className="mt-[3px] size-3 shrink-0 text-text-faint" aria-hidden />
          <span>{p.message.text}</span>
        </p>
        <p className="num mt-1.5 text-[11px] text-text-muted">
          {p.message.author} · {new Date(p.message.at).toLocaleTimeString()}
          {p.message.intent ? ` · ${p.message.intent}` : ""}
        </p>
      </section>

      {/* what was drafted -------------------------------------------------- */}
      <section>
        <SectionLabel>
          {p.sentText ? "What went out" : blocked ? "What was blocked" : "The draft"}
        </SectionLabel>
        <p
          className={cn(
            "mt-1.5 rounded-sm px-2.5 py-2 text-[12.5px] leading-relaxed",
            blocked ? "bg-bad/[0.07] text-text" : "bg-elevated",
          )}
        >
          {p.sentText ?? p.draft}
        </p>
        {p.sentText && p.sentText.trim() !== p.draft.trim() ? (
          <p className="mt-1.5 text-[11.5px] text-text-muted">
            You edited this before sending. The original draft is kept in the report — an edit rate
            is the only honest read on draft quality.
          </p>
        ) : null}
        {p.repaired ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] text-warn">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />A guard sent this back
            once and it was re-grounded against current listing state.
          </p>
        ) : null}
      </section>

      {/* what it stands on ------------------------------------------------- */}
      <section>
        <SectionLabel>Grounded in</SectionLabel>
        {p.evidence.length === 0 ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-text-secondary">
            <CircleSlash className="mt-0.5 size-3 shrink-0 text-text-muted" aria-hidden />
            Nothing — the copilot abstained rather than answer from nowhere. That is the correct
            behaviour and it is counted as an abstention, not a failure.
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-2">
            {p.evidence.map((e) => (
              <li key={e.factId} className="rounded-sm bg-elevated px-2.5 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{e.label}</span>
                  <Badge>{SOURCE_LABEL[e.source]}</Badge>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{e.text}</p>
                <p className="num mt-1 flex items-center gap-2 text-[11px] text-text-faint">
                  <Hash className="size-2.5" aria-hidden />
                  {e.factId}
                  {e.listingVersion != null ? ` · v${e.listingVersion}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* what checked it --------------------------------------------------- */}
      <section>
        <SectionLabel>Every guard that ran</SectionLabel>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {p.guards.map((g) => (
            <GuardRow key={g.guard} g={g} />
          ))}
        </ul>
      </section>

      {/* what it cost in time ---------------------------------------------- */}
      <section>
        <SectionLabel>Where the time went</SectionLabel>
        <Spans p={p} />
      </section>

      {related.length ? (
        <section>
          <SectionLabel>In the chain</SectionLabel>
          <ul className="mt-1.5 flex flex-col gap-1">
            {related.map((a) => (
              <li key={a.seq} className="num flex items-baseline gap-2 text-[11.5px]">
                <span className="text-text-faint">#{a.seq}</span>
                <span className="min-w-0 flex-1 text-text-secondary">{a.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function GuardRow({ g }: { g: GuardResult }) {
  const tone =
    g.verdict === "allow"
      ? "text-ok"
      : g.verdict === "revise"
        ? "text-warn"
        : g.verdict === "block"
          ? "text-bad"
          : "text-text-muted";
  const Icon = g.verdict === "allow" ? Check : g.verdict === "n/a" ? CircleSlash : AlertTriangle;
  return (
    <li className="flex gap-2 rounded-sm bg-elevated px-2.5 py-2">
      <Icon className={cn("mt-0.5 size-3.5 shrink-0", tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-medium">{GUARD_LABEL[g.guard] ?? g.guard}</span>
          <span className={cn("text-[11px]", tone)}>{g.verdict}</span>
        </div>
        <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
          {g.reason ?? "Did not apply to this reply."}
        </p>
        {g.detail?.expected || g.detail?.found ? (
          <dl className="num mt-1 flex flex-col gap-0.5 text-[11px]">
            {g.detail.expected ? (
              <div className="flex gap-2">
                <dt className="w-14 text-text-faint">expected</dt>
                <dd className="text-ok">{g.detail.expected}</dd>
              </div>
            ) : null}
            {g.detail.found ? (
              <div className="flex gap-2">
                <dt className="w-14 text-text-faint">found</dt>
                <dd className="text-bad">{g.detail.found}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
    </li>
  );
}

/** The budget is the point, so the bar is drawn against the budget, not the max. */
function Spans({ p }: { p: ReplyProposal }) {
  const s = p.spans;
  const rows: [string, number][] = [
    ["admit", s.admitMs],
    ["classify", s.classifyMs],
    ["retrieve", s.retrieveMs],
    ["compose", s.composeMs],
    ["guard", s.guardMs],
    ...(s.repairMs ? ([["repair", s.repairMs]] as [string, number][]) : []),
  ];
  const budget = s.budgetMs || 2000;
  return (
    <div className="mt-1.5">
      <div className="flex items-baseline gap-2">
        <span className={cn("num text-[20px] leading-none", s.overBudget ? "text-bad" : "text-ok")}>
          {formatMs(s.totalMs)}
        </span>
        <span className="text-[11.5px] text-text-muted">
          of a {formatMs(budget)} budget
          {s.cacheHit ? " · served from cache" : ""}
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {rows.map(([label, ms]) => (
          <li key={label} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[11.5px] text-text-muted">{label}</span>
            <span className="h-1.5 min-w-0 flex-1 rounded-full bg-hairline">
              <span
                className={cn("block h-1.5 rounded-full", s.overBudget ? "bg-bad" : "bg-accent")}
                style={{ width: `${Math.min(100, (ms / budget) * 100)}%` }}
              />
            </span>
            <span className="num w-12 shrink-0 text-right text-[11px] text-text-secondary">
              {formatMs(ms)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AuditDetail({ entry }: { entry: AuditEntry }) {
  const pairs = Object.entries(entry.detail ?? {}).filter(
    ([, v]) => v != null && typeof v !== "object",
  );
  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="flex items-baseline gap-2">
          <span className="num text-[20px] leading-none">#{entry.seq}</span>
          <Badge {...(entry.actorType === "copilot" ? { tone: "accent" as const } : {})}>
            {entry.actorType}
          </Badge>
          <span className="num ml-auto text-[11px] text-text-muted">
            {new Date(entry.at).toLocaleTimeString()}
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed">{entry.summary}</p>
        <p className="mt-1 text-[11.5px] text-text-muted">{entry.kind.replace(/_/g, " ")}</p>
      </section>

      {pairs.length ? (
        <section>
          <SectionLabel>What was recorded</SectionLabel>
          <dl className="mt-1.5 flex flex-col gap-1">
            {pairs.map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[12px]">
                <dt className="w-28 shrink-0 text-text-muted">{k}</dt>
                <dd className="num min-w-0 flex-1 break-words">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section>
        <SectionLabel>Its place in the chain</SectionLabel>
        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-text-secondary">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden />
          Each entry hashes the one before it, so an entry cannot be edited or removed without
          breaking every hash after it. Verify the chain from the audit header.
        </p>
        <dl className="num mt-2 flex flex-col gap-1 text-[11px]">
          <div className="flex gap-2">
            <dt className="w-12 shrink-0 text-text-faint">hash</dt>
            <dd className="min-w-0 flex-1 break-all">{entry.hash}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-12 shrink-0 text-text-faint">prev</dt>
            <dd className="min-w-0 flex-1 break-all text-text-muted">{entry.prevHash}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/** Header line for the panel, so the shell's title can say what is in it. */
export function inspectorTitle(
  subject: InspectorSubject,
  proposals: ReplyProposal[],
): { title: string; icon: typeof FileText } {
  if (subject.kind === "audit") return { title: `Audit entry #${subject.seq}`, icon: Clock };
  const p = proposals.find((x) => x.id === subject.id);
  return { title: p ? `Why this reply` : "Reply", icon: FileText };
}
