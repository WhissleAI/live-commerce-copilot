import { createFileRoute } from "@tanstack/react-router";
import { KnowledgePage } from "@/components/pages/KnowledgePage";

/**
 * Knowledge — what the copilot is allowed to answer from.
 *
 * It was called Catalog when a catalog was the only ground truth there was.
 * Seven corpus kinds later — listings, policies, schedule, sponsor briefs,
 * product docs, community rules, prior answers — "catalog" names one of them
 * and the page holds all seven. `/catalog` still resolves here.
 *
 * `/knowledge?id=<catalogId>` opens straight onto one corpus — the link a
 * prepared session on Discover carries to its lineup.
 */
export const Route = createFileRoute("/knowledge")({
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s["id"] === "string" && s["id"] ? { id: s["id"] } : {},
  head: () => ({ meta: [{ title: "SideStage — Knowledge" }] }),
  component: function KnowledgeRoute() {
    const { id } = Route.useSearch();
    return <KnowledgePage initialId={id} />;
  },
});
