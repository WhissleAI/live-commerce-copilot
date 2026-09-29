import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { ReportPage } from "@/components/pages/ReportPage";

export const Route = createFileRoute("/reports/$showId")({
  head: () => ({ meta: [{ title: "SideStage — Show report" }, ...noindexMeta()] }),
  component: function ReportRoute() {
    const { showId } = Route.useParams();
    return <ReportPage showId={showId} />;
  },
});
