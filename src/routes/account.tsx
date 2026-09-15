import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/pages/AccountPage";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "SideStage — Account" }] }),
  component: AccountPage,
});
