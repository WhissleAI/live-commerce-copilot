import { createFileRoute } from "@tanstack/react-router";
import { RoomsPage } from "@/components/pages/RoomsPage";

export const Route = createFileRoute("/rooms")({
  head: () => ({ meta: [{ title: "SideStage — Rooms" }] }),
  component: RoomsPage,
});
