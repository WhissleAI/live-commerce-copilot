import { createFileRoute } from "@tanstack/react-router";
import { Console } from "@/components/console/Console";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SideStage — Live Selling Copilot Console" },
      {
        name: "description",
        content:
          "Keyboard-first operator console for live commerce: approve copilot replies, review guardrails, and commit bounded actions with undo.",
      },
      { property: "og:title", content: "SideStage — Live Selling Copilot Console" },
      {
        property: "og:description",
        content:
          "Approve or reject AI-drafted buyer replies in under two seconds, with provenance, guardrails and an audit chain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Console,
});
