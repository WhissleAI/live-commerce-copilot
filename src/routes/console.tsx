import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { Console } from "@/components/console/Console";

export const Route = createFileRoute("/console")({
  head: () => ({ meta: [{ title: "SideStage — Console" }, ...noindexMeta()] }),
  component: () => <Console />,
});
