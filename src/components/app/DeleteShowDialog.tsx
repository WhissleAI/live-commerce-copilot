/**
 * The only modal in the product.
 *
 * Deleting a session removes the session, its chat, its hash-chained audit log,
 * its report — and the Whissle agent this app created for that stream, with
 * every knowledge-base document in it. The endpoint has existed for weeks with
 * nothing calling it, and wiring it up without a sentence naming all of that
 * would be the fastest way to lose an agent to a mis-click.
 */

import { useEffect, useRef, useState } from "react";
import { useDialog } from "@/hooks/useDialog";
import { operatorMessage } from "@/lib/copy";
import { AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ShowRow } from "@/lib/types";
import { Button } from "@/components/ui/kit";

export function DeleteShowDialog({
  row,
  onClose,
  onDeleted,
}: {
  row: ShowRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteShow(row.showId);
      onDeleted();
    } catch (e) {
      setError(operatorMessage(e));
      setBusy(false);
    }
  }

  // CONTENT-40: this dialog focused nothing at all, so a screen-reader user
  // got no announcement that a delete confirmation had appeared and the
  // confirm button was several Tabs away behind whatever had focus before.
  // The initial target is deliberately Cancel: a destructive dialog should
  // not open with the destructive control under the operator's thumb.
  const dialog = useRef<HTMLDivElement | null>(null);
  useDialog(dialog, true, "[data-dialog-initial]");

  return (
    <div
      ref={dialog}
      className="fixed inset-0 z-[100] grid place-items-center bg-canvas/70 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Delete ${row.title}`}
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-in w-[460px] max-w-full rounded-lg bg-panel p-5 z4"
      >
        <h2 className="text-[15px] font-semibold">Delete “{row.title}”?</h2>
        <p className="mt-2 text-[12.5px] text-text-secondary">This removes, permanently:</p>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          <li className="flex gap-2 text-[12.5px] text-text-secondary">
            <span className="text-bad">·</span>
            the session, its chat and its {row.answered ?? 0} answered questions
          </li>
          <li className="flex gap-2 text-[12.5px] text-text-secondary">
            <span className="text-bad">·</span>
            its Whissle agent <span className="num text-text">{row.agentId ?? "—"}</span> and every
            knowledge-base document in it
          </li>
          <li className="flex gap-2 text-[12.5px] text-text-secondary">
            <span className="text-bad">·</span>
            its hash-chained audit log and its report
          </li>
        </ul>
        <p className="mt-3 text-[12.5px] text-text-muted">
          Your catalog, policies and comps are not touched.
        </p>

        {error ? (
          <p className="mt-3 flex items-start gap-2 rounded-sm bg-bad/[0.07] px-3 py-2 text-[12.5px] text-bad">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy} data-dialog-initial>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Delete session and agent
          </Button>
        </div>
      </div>
    </div>
  );
}
