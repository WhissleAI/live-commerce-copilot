import { createFileRoute } from "@tanstack/react-router";
import { CostPage } from "@/components/pages/CostPage";

export const Route = createFileRoute("/cost")({
  head: () => ({ meta: [{ title: "SideStage — Cost" }] }),
  component: CostPage,
});
