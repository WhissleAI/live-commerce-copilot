import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage, type SettingsTab, SETTINGS_TABS } from "@/components/pages/SettingsPage";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "SideStage — Settings" }] }),
  // `/settings?tab=ebay` opens straight onto a tab, so a "Connect" link from
  // Shows lands on the eBay panel rather than on Guardrails.
  validateSearch: (s: Record<string, unknown>): { tab?: SettingsTab } =>
    SETTINGS_TABS.includes(s["tab"] as SettingsTab) ? { tab: s["tab"] as SettingsTab } : {},
  component: function SettingsRoute() {
    const { tab } = Route.useSearch();
    return <SettingsPage initialTab={tab} />;
  },
});
