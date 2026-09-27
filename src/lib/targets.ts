// The PRD's numeric targets, in one place.
//
// These were inlined at every tile that grades against them — three sites in
// AnalyticsPage, two in ReportPage — and they drifted, which is exactly what a
// duplicated constant does. Time-to-answer was corrected to the PRD's 10 s on
// the report and stayed at the original brief's 2 s on Analytics, so the SAME
// measurement was graded against two different bars on two screens, and a
// 3.07 s p95 read as comfortably inside target on one and as a miss on the
// other. A reviewer diffing the PRD against the product finds that in a
// minute, and they are right to.
//
// Each value cites the PRD section that sets it, so the next person to change
// one knows what they are arguing with.

/**
 * Time to answer, p95. **PRD §4: < 10 s.**
 *
 * The original brief asked for sub-2-second and the PRD relaxed it once there
 * were real numbers: past roughly a minute the buyer has scrolled and the
 * answer no longer converts, so the bar is "still useful", not "instant". The
 * 2 s figure survives in the repo's history and should not come back without
 * the PRD moving first.
 */
export const P95_ANSWER_MS = 10_000;

/**
 * Median operator decision — card shown → sent or dismissed. **PRD §4: < 2 s.**
 *
 * Genuinely two seconds, and not a leftover: this one measures the HUMAN, who
 * is on camera, and the whole claim of the product is that a proposal can be
 * judged at a glance.
 */
export const DECISION_MS = 2_000;

/** Answered-question rate. **PRD §4: > 85%.** */
export const ANSWERED_RATE = 0.85;

/** Guardrail block rate. **PRD §4: < 5%** of drafts — higher means the
 *  grounding is bad, not that the guards are good. */
export const BLOCK_RATE = 0.05;

/** Seller edit rate on sent drafts. **PRD §4: < 20%.** */
export const EDIT_RATE = 0.2;

/** Actions rolled back. **PRD §4: < 10%** — higher means preflight is too
 *  permissive. */
export const ROLLBACK_RATE = 0.1;

/** The label a tile shows beside a latency value. Derived, so the words and
 *  the comparison can never disagree. */
export const targetLabel = (ms: number): string => `target <${ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`}`;
