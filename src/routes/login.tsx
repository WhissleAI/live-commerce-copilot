import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { AuthPage } from "@/components/pages/AuthPage";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "SideStage — Sign in" }, ...noindexMeta()] }),
  component: () => <AuthPage mode="login" />,
});
