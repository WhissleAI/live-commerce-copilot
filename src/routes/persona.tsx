import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { PersonaPage } from "@/components/pages/PersonaPage";

export const Route = createFileRoute("/persona")({
  head: () => ({ meta: [{ title: "SideStage — Persona" }, ...noindexMeta()] }),
  component: PersonaPage,
});
