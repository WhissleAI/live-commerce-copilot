import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "@/components/pages/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "SideStage — Terms of use" }] }),
  component: TermsPage,
});
