import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/components/pages/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "SideStage — Privacy policy" }] }),
  component: PrivacyPage,
});
