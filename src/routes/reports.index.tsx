import { createFileRoute, redirect } from "@tanstack/react-router";

/** There is no separate list of past shows: every show, on air or behind you,
 *  is one list on Home, and each finished one carries its Report button. */
export const Route = createFileRoute("/reports/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
