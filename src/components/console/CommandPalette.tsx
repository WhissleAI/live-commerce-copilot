import { useEffect, useRef, useState } from "react";
import { Loader2, Search, ShieldCheck, Sliders, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatMs } from "@/lib/format";
import type { ResearchCard } from "@/lib/types";
import { Hover } from "./primitives";

export function CommandPalette({
  open,
  onClose,
  onResearch,
  onQuickAction,
  pinnedTitle,
}: {
  open: boolean;
  onClose: () => void;
  onResearch: (query: string) => Promise<ResearchCard>;
  onQuickAction: (a: "research_pinned" | "autonomy" | "verify") => void;
  pinnedTitle: string | null;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<ResearchCard | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCard(null);
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const run = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setCard(null);
    try {
      setCard(await onResearch(q.trim()));
    } finally {
      setLoading(false);
    }
  };

  const quick = [
    {
      id: "research_pinned" as const,
      icon: Tag,
      label: `Research the pinned lot${pinnedTitle ? ` — ${pinnedTitle}` : ""}`,
    },
    { id: "autonomy" as const, icon: Sliders, label: "Set autonomy level" },
    { id: "verify" as const, icon: ShieldCheck, label: "Verify audit chain" },
  ];

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-canvas/75 pt-[12vh]"
      onClick={onClose}
      role="dialog"
      aria-label="Research command palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-in w-[680px] max-w-[92vw] overflow-hidden rounded-md border border-hairline-strong bg-panel"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-3">
          <Search className="size-3.5 text-text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void run(query);
              }
              if (e.key === "Escape") onClose();
            }}
            placeholder="Research a product…"
            className="h-11 flex-1 bg-transparent text-[13px] text-text placeholder:text-text-muted focus:outline-none"
          />
          {loading ? <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden /> : null}
        </div>

        {!query && !card && !loading ? (
          <ul className="p-1">
            {quick.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (q.id === "research_pinned" && pinnedTitle) {
                      void run(pinnedTitle);
                      return;
                    }
                    onQuickAction(q.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-[12px] text-text-secondary hover:bg-elevated hover:text-text"
                >
                  <q.icon className="size-3.5 text-text-muted" aria-hidden />
                  {q.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {loading ? (
          <p className="px-3 py-4 text-[12px] text-text-muted">Pulling comparable sales…</p>
        ) : null}

        {card ? (
          <div className="relative space-y-3 p-3">
            <span
              className={cn(
                "num absolute top-3 right-3 text-[11px]",
                card.latencyMs > 2000 ? "text-bad" : "text-text-muted",
              )}
            >
              {formatMs(card.latencyMs)}
            </span>
            <div>
              <h2 className="text-[13px] font-semibold text-text">{card.headline}</h2>
              <div className="num mt-1 text-[26px] leading-none text-text">
                {formatMoney(card.medianCents)}
                <span className="ml-2 text-[11px] text-text-muted">median comp</span>
              </div>
            </div>

            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="font-normal">title</th>
                  <th className="font-normal">size</th>
                  <th className="font-normal">cond</th>
                  <th className="text-right font-normal">sold</th>
                  <th className="text-right font-normal">date</th>
                </tr>
              </thead>
              <tbody>
                {card.comps.map((c, i) => (
                  <tr key={i} className="border-t border-hairline text-text-secondary">
                    <td className="max-w-[280px] truncate py-0.5">{c.title}</td>
                    <td className="num">{c.size}</td>
                    <td>{c.condition}</td>
                    <td className="num text-right text-text">{formatMoney(c.soldPriceCents)}</td>
                    <td className="num text-right">
                      {new Date(c.soldAt).toISOString().slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="rounded-[4px] border border-hairline bg-canvas px-2 py-1.5 text-[12px] text-text">
              {card.suggestion}
            </p>

            {card.specDiff?.length ? (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-text-muted">
                    <th className="font-normal">attribute</th>
                    <th className="font-normal">ours</th>
                    <th className="font-normal">theirs</th>
                  </tr>
                </thead>
                <tbody>
                  {card.specDiff.map((d) => (
                    <tr key={d.attribute} className="border-t border-hairline text-text-secondary">
                      <td className="py-0.5">{d.attribute}</td>
                      <td className="text-text">{d.ours}</td>
                      <td>{d.theirs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {card.evidence.map((e) => (
                <Hover
                  key={e.factId}
                  side="top"
                  panelClassName="w-72"
                  content={
                    <div>
                      <div className="text-text">{e.text}</div>
                      <div className="num mt-1 text-[11px] text-text-muted">{e.factId}</div>
                    </div>
                  }
                >
                  <span
                    tabIndex={0}
                    className="rounded-[4px] border border-hairline-strong bg-canvas px-1.5 py-0.5 text-[11px] text-text-secondary hover:border-accent"
                  >
                    {e.label}
                  </span>
                </Hover>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
