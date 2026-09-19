import { createFileRoute } from "@tanstack/react-router";
import { PersonaPage } from "@/components/pages/PersonaPage";

export const Route = createFileRoute("/persona")({
  head: () => ({ meta: [{ title: "SideStage — Persona" }] }),
  component: PersonaPage,
});
