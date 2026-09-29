import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { AuthPage } from "@/components/pages/AuthPage";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "SideStage — Create an account" }, ...noindexMeta()] }),
  component: () => <AuthPage mode="register" />,
});
