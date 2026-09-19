/**
 * Who owns a keypress.
 *
 * The console is sold as keyboard-first and prints its keymap on the card, so
 * the rules for when a single key acts have to be one thing, in one place,
 * testable without mounting the console. They were three inline conditions in
 * `Console.tsx` and two of them were wrong:
 *
 *  - `BUTTON` was treated as a typing context. It was added to stop a bare
 *    Enter both re-firing a just-clicked button and sending the focused
 *    proposal — a real double-fire — but it took J, K, E, X, R, A, U, I and
 *    `?` with it, permanently, because nothing blurs after a card action. The
 *    keymap died the first time anyone used the mouse. The Enter double-fire
 *    is an Enter problem, so it is fixed at Enter (`activatesOnEnter`) and
 *    nowhere else.
 *
 *  - Only the research palette was treated as a modal. The legend opens by
 *    itself on a new browser, and Enter — the reflex that dismisses a modal —
 *    reached the queue and approved a reply the operator had not read. Modals
 *    are rendered by five different components and one of them is the shell,
 *    which the console holds no flag for, so the DOM is the only place that
 *    knows about all of them: anything with `role="dialog"` up means single
 *    keys are not ours.
 */

/**
 * A text-entry context. Typing "j" into the edit box must insert a j, not move
 * the queue. Note what is NOT here: a button is not a typing context.
 */
export function isTypingIn(el: Element | null | undefined): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable === true;
}

/**
 * The browser will already fire this element's own click on Enter. Acting on
 * the queue as well is the double-fire: "Edit" re-opens the editor *and* the
 * draft is sent.
 */
export function activatesOnEnter(el: Element | null | undefined): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
  const role = el.getAttribute?.("role");
  return role === "button" || role === "switch" || role === "menuitem" || role === "link";
}

/**
 * Something modal is on screen: the command bar, the research palette, the
 * shortcut card, the legend, a delete confirmation, the timeline. Every one of
 * them carries `role="dialog"`, which is the only property they share — four
 * of the six are not rendered by the console.
 */
export function modalOpen(doc: Document = document): boolean {
  return doc.querySelector('[role="dialog"]') !== null;
}

/**
 * Should a bare single-key shortcut act right now?
 *
 * `key` matters for exactly one reason: Enter is the key a focused button has
 * a prior claim on. Everything else is the queue's while no modal is up and
 * nothing is being typed into.
 */
export function shortcutActs(key: string, doc: Document = document): boolean {
  if (modalOpen(doc)) return false;
  const el = doc.activeElement;
  if (isTypingIn(el)) return false;
  if (key === "Enter" && activatesOnEnter(el)) return false;
  return true;
}
