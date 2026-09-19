/**
 * One toast rail, bottom-left, carrying the undo.
 *
 * A send, a commit and a rollback each change the world and produced no
 * acknowledgement outside the card that scrolled away. The undo for a committed
 * action lived only on that card too, so it expired unseen.
 *
 * Rules: at most three at a time, newest at the bottom, five seconds unless it
 * carries an action, and never more than one line. A toast is a receipt, not a
 * place to put a paragraph.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Info, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Toast {
  id: string;
  tone: "ok" | "warn" | "bad" | "neutral";
  text: string;
  /** Present only when there is something to take back. */
  undo?: { label: string; onUndo: () => void; untilMs?: number };
}

export interface Toasts {
  items: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const MAX = 3;
const LIFE_MS = 5000;

export function useToasts(): Toasts {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      setItems((prev) => [...prev, { ...t, id }].slice(-MAX));
      // A toast with an undo stays until its window closes; everything else is
      // a receipt and goes.
      const life = t.undo?.untilMs ? Math.max(1000, t.undo.untilMs - Date.now()) : LIFE_MS;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), life),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  return useMemo(() => ({ items, push, dismiss }), [items, push, dismiss]);
}

const ToastCtx = createContext<Toasts | null>(null);
export const useToastRail = () => useContext(ToastCtx);

export function ToastRail({ toasts }: { toasts: Toasts }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!toasts.items.some((t) => t.undo?.untilMs)) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [toasts.items]);

  // CONTENT-39: this returned null when empty, so the live region was
  // inserted into the DOM in the same tick as its first message — which
  // assistive technology generally does not announce, because it was not
  // watching a region that did not exist. Enter, then silence, on the only
  // feedback the console has for "Reply sent to X" and "Not sent — …".
  //
  // The region is mounted always and empty, and a failure gets its own
  // assertive one: `tone: "bad"` in a polite region is a refusal the operator
  // hears after whatever else was queued, if at all.
  const bad = toasts.items.filter((t) => t.tone === "bad");
  const rest = toasts.items.filter((t) => t.tone !== "bad");

  return (
    <>
      <div className="sr-only" aria-live="assertive" role="alert">
        {bad.map((t) => (
          <p key={t.id}>{t.text}</p>
        ))}
      </div>
      <div className="sr-only" aria-live="polite">
        {rest.map((t) => (
          <p key={t.id}>{t.text}</p>
        ))}
      </div>
      {toasts.items.length ? renderRail() : null}
    </>
  );

  function renderRail() {
    return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-30 flex w-[300px] flex-col gap-1.5"
    >
      {toasts.items.map((t) => {
        const left = t.undo?.untilMs
          ? Math.max(0, Math.round((t.undo.untilMs - now) / 1000))
          : null;
        return (
          <div
            key={t.id}
            className={cn(
              "anim-in pointer-events-auto flex items-center gap-2.5 rounded-md bg-panel px-3 py-2 z3",
              t.tone === "ok" && "ring-1 ring-ok/40",
              t.tone === "warn" && "ring-1 ring-warn/45",
              t.tone === "bad" && "ring-1 ring-bad/45",
            )}
          >
            {t.tone === "ok" ? (
              <Check className="size-3.5 shrink-0 text-ok" aria-hidden />
            ) : (
              <Info className="size-3.5 shrink-0 text-text-muted" aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate text-[12px]">{t.text}</span>
            {t.undo && (left == null || left > 0) ? (
              <button
                type="button"
                onClick={() => {
                  t.undo?.onUndo();
                  toasts.dismiss(t.id);
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-sm bg-elevated px-2 py-1 text-[11.5px] text-text-secondary hover:text-text"
              >
                <Undo2 className="size-3" aria-hidden />
                {t.undo.label}
                {left != null ? <span className="num">{left}s</span> : null}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => toasts.dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 text-text-muted hover:text-text"
              >
                <X className="size-3" aria-hidden />
              </button>
            )}
          </div>
        );
      })}
    </div>
    );
  }
}

export function ToastProvider({ toasts, children }: { toasts: Toasts; children: ReactNode }) {
  return <ToastCtx.Provider value={toasts}>{children}</ToastCtx.Provider>;
}
