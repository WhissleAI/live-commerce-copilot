import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { AnalyticsPage } from "@/components/pages/AnalyticsPage";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "SideStage — Analytics" }, ...noindexMeta()] }),
  component: AnalyticsPage,
});
