import { createFileRoute, redirect } from "@tanstack/react-router";

/** Shows IS home now. Old links and muscle memory land in the right place. */
export const Route = createFileRoute("/shows")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
