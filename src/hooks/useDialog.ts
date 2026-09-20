/**
 * One focus behaviour for every modal in the app.
 *
 * CONTENT-40. Six dialogs — the command bar, the research palette, the
 * shortcuts card, the legend, the delete confirmation and the report timeline
 * — each set `role="dialog"` and then did none of the three things that makes
 * a dialog a dialog:
 *
 *  · nothing was focused when it opened, so a screen-reader user was not told
 *    one had appeared. `DeleteShowDialog` is the worst case: a destructive
 *    confirmation where the confirm button was several Tabs away behind
 *    whatever had focus before.
 *  · Tab left the dialog and walked the page behind it.
 *  · focus was not restored on close, so dismissing a modal dropped the
 *    operator back onto `<body>` — which is also how the console's keymap
 *    used to come back to life, by accident.
 *
 * It is a hook rather than a component because the six dialogs have six
 * different shapes and only their behaviour is shared. `Escape` stays where it
 * already is in each of them: the console owns an ordered Escape chain and a
 * hook that closed the top dialog first would fight it.
 */

import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Visible enough to take focus. Deliberately not `offsetParent`, which is the
 * usual test and is always null under jsdom, so the trap would be untestable —
 * and an untested focus trap is how a focus trap comes to be broken.
 */
function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.hasAttribute("hidden") || el.closest("[hidden]")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

/**
 * Trap focus inside `ref` while `open`, and give it back on close.
 *
 * `initial` names what to focus first, as a selector inside the dialog. The
 * default is the first focusable thing — which for a confirmation is the
 * dialog's first control, so a destructive dialog should pass its own safe
 * choice rather than take that.
 */
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  initial?: string,
): void {
  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;

    // Where to give focus back to. Captured before we move it.
    const returnTo = document.activeElement as HTMLElement | null;

    const first = (initial && root.querySelector<HTMLElement>(initial)) ?? focusable(root)[0];
    // A dialog with nothing focusable in it still has to take focus, or the
    // announcement never happens: the container itself will do.
    if (first) first.focus();
    else {
      root.setAttribute("tabindex", "-1");
      root.focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? lastItem : firstItem).focus();
        return;
      }
      if (e.shiftKey && active === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Only if the thing we took focus from is still on the page. A dialog
      // that deleted the row it was opened from has nowhere to go back to.
      if (returnTo && document.contains(returnTo)) returnTo.focus();
    };
  }, [ref, open, initial]);
}
