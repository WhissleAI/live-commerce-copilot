import { createFileRoute } from "@tanstack/react-router";
import { SetupPage } from "@/components/pages/SetupPage";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "SideStage — Monitor a show" }] }),
  validateSearch: (search: Record<string, unknown>): { showId?: string } =>
    typeof search["showId"] === "string" ? { showId: search["showId"] } : {},
  component: function SetupRoute() {
    const { showId } = Route.useSearch();
    return <SetupPage showId={showId} />;
  },
});
