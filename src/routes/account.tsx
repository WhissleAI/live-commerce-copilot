import { createFileRoute } from "@tanstack/react-router";
import { noindexMeta } from "@/lib/meta";
import { AccountPage } from "@/components/pages/AccountPage";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "SideStage — Account" }, ...noindexMeta()] }),
  component: AccountPage,
});
