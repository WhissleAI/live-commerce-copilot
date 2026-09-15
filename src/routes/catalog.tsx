import { createFileRoute } from "@tanstack/react-router";
import { CatalogPage } from "@/components/pages/CatalogPage";

/** `/catalog?id=<catalogId>` opens straight onto one catalog — the link a
 *  prepared show on Discover carries to its lineup. */
export const Route = createFileRoute("/catalog")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s["id"] === "string" && s["id"] ? { id: s["id"] } : {},
  head: () => ({ meta: [{ title: "SideStage — Catalog" }] }),
  component: function CatalogRoute() {
    const { id } = Route.useSearch();
    return <CatalogPage initialId={id} />;
  },
});
