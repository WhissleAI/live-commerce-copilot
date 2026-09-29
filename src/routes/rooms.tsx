import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { RoomsPage } from "@/components/pages/RoomsPage";

export const Route = createFileRoute("/rooms")({
  head: () => ({ meta: [{ title: "SideStage — Rooms" }, ...noindexMeta()] }),
  component: RoomsPage,
});
