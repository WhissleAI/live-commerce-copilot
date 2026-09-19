import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Knowledge IS the catalog page now, under the name that covers all seven
 * corpus kinds. Every link ever written to `/catalog` — including the ones
 * Discover carries to a prepared session's lineup — lands in the right place,
 * with its `id` intact.
 */
export const Route = createFileRoute("/catalog")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s["id"] === "string" && s["id"] ? { id: s["id"] } : {},
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/knowledge", search: search.id ? { id: search.id } : {} });
  },
});
