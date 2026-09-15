import { createFileRoute } from "@tanstack/react-router";
import { Console } from "@/components/console/Console";

export const Route = createFileRoute("/console")({
  head: () => ({ meta: [{ title: "SideStage — Console" }] }),
  component: () => <Console />,
});
