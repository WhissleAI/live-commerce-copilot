/**
 * Which page `/` is, given what is known about the session.
 *
 * One line, extracted, because the interesting case is the one that is easy to
 * get wrong and impossible to see: what `/` renders before anything is known.
 * It returned nothing at all, which made the server's response an empty body —
 * so the front door had no content for any client that does not run JavaScript,
 * and no content for a person either until /api/auth/me answered from EC2.
 *
 * `unknown` is the SSR state and the first-hydration state, and it resolves to
 * the landing page: the page an unauthenticated request should get, and the one
 * the server can actually know without a session.
 */
export type SessionState = "unknown" | "in" | "out";

export function frontDoor(state: SessionState): "home" | "landing" {
  return state === "in" ? "home" : "landing";
}
