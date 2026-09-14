import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/pages/SettingsPage";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "SideStage — Guardrails" }] }),
  component: SettingsPage,
});
