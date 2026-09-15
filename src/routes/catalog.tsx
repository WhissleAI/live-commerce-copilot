import { createFileRoute } from "@tanstack/react-router";
import { CatalogPage } from "@/components/pages/CatalogPage";

export const Route = createFileRoute("/catalog")({
  head: () => ({ meta: [{ title: "SideStage — Catalog" }] }),
  component: CatalogPage,
});
