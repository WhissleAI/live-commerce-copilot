import { createFileRoute } from "@tanstack/react-router";
import { DraftsPage } from "@/components/pages/DraftsPage";

/** Where a reply goes on a surface we do not post to. The one destination in
 *  the product whose whole point is that a human is the sender. */
export const Route = createFileRoute("/drafts")({
  head: () => ({ meta: [{ title: "SideStage — Drafts" }] }),
  component: DraftsPage,
});
