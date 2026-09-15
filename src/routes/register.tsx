import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/pages/AuthPage";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "SideStage — Create an account" }] }),
  component: () => <AuthPage mode="register" />,
});
