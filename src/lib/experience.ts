// How much the product should explain itself right now.
//
// Every band on Home, every section on Discover and every tile on the report
// carries a sentence or two saying what it is. That copy is the right call on a
// first run and it is the whole reason the product reads as trustworthy rather
// than magic. It is the wrong call on the fortieth: an operator who is about to
// be on camera is reading ~1,300 words on Home and ~3,000 on the report, almost
// none of which is a number they came for.
//
// So the explanation steps back once it has been earned — and the signal for
// "earned" is DERIVED FROM WHAT THEY HAVE ACTUALLY DONE, never from a dismissed
// banner. A dismiss flag lies the moment they open the product on the tablet in
// the studio, and it lies in the other direction too: someone who clicked it
// away on day one still does not know what a gap is on day two.
//
// Finishing a session is the honest line. It means they have been through
// prepare, console and report at least once, which is exactly the vocabulary
// the copy teaches.
import type { HomeModel, } from "./home";
import type { PromotionReadiness } from "./types";

export type Experience = "first_run" | "practised";

/**
 * Two states, on purpose.
 *
 * A middle rung was drafted and dropped: every threshold it could use was a
 * number nobody could defend ("three sessions"), and the failure mode of
 * getting it wrong is a person who cannot find the sentence that tells them
 * what they are looking at.
 */
export function experienceOf(m: Pick<HomeModel, "behind">): Experience {
  return m.behind.reports.length > 0 ? "practised" : "first_run";
}

/**
 * Should this particular explainer stay open?
 *
 * Two rules, and the second one is the one that stops this being a feature that
 * hides things:
 *
 *  1. A first run reads everything.
 *  2. **An empty band keeps its explanation whatever their experience** — when
 *     there is no data, the sentence saying what would be here IS the content,
 *     and collapsing it leaves a heading over blank space. This is the case a
 *     progressive-disclosure pass usually gets wrong.
 */
export function teachOpen(exp: Experience, opts: { hasContent: boolean }): boolean {
  if (exp === "first_run") return true;
  return !opts.hasContent;
}

/**
 * The same question on a post-session report, answered from what the report
 * already holds.
 *
 * `PromotionReadiness` is scored across the operator's own finished sessions
 * and each criterion carries `showsSeen` — how many it was judged against. That
 * is the same "have you been through this before" fact the home derivation
 * uses, and it is already on the page, so reading it costs no extra request.
 *
 * MORE THAN ONE, not at least one: the report you are reading is itself a
 * finished session, so `showsSeen === 1` is the first report this operator has
 * ever opened — exactly when every sentence should be there.
 *
 * Unknown readiness reads as a first run. The safe direction to be wrong in is
 * explaining something to someone who already knew it.
 */
export function experienceOfReport(readiness: PromotionReadiness | null): Experience {
  if (!readiness) return "first_run";
  const seen = Math.max(0, ...readiness.criteria.map((c) => c.showsSeen ?? 0));
  return seen > 1 ? "practised" : "first_run";
}
