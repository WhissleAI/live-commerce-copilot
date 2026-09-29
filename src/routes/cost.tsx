import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { CostPage } from "@/components/pages/CostPage";

export const Route = createFileRoute("/cost")({
  head: () => ({ meta: [{ title: "SideStage — Cost" }, ...noindexMeta()] }),
  component: CostPage,
});
