import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/pages/AuthPage";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "SideStage — Sign in" }] }),
  component: () => <AuthPage mode="login" />,
});
