import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "@/components/pages/AnalyticsPage";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "SideStage — Analytics" }] }),
  component: AnalyticsPage,
});
