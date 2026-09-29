/**
 * The answer button told the seller the wrong thing about the backlog.
 *
 * Every un-admitted message gets an "answer" affordance, and its tooltip said
 * "the gate dropped this one". True of most of them; not true of the backlog.
 * A message already on screen when the console attached was never judged by the
 * gate at all — nobody was listening yet. (The backend half of this is
 * sidestage-copilot#68, which stopped the backlog reporting a rate cap the
 * seller never hit.)
 *
 * Small, but it is the one surface whose whole claim is that it says where a
 * thing came from.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatColumn } from "./ChatColumn";
import type { ChatMessage } from "@/lib/types";

function msg(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: "m1",
    author: "@buyer",
    text: "do you ship to canada?",
    at: new Date().toISOString(),
    admitted: false,
    ...over,
  } as ChatMessage;
}

function mount(m: ChatMessage) {
  render(
    <ChatColumn
      chat={[m]}
      onInject={() => {}}
      onHoverProposal={() => {}}
      linkedProposalIds={new Set()}
      onAnswerDropped={() => {}}
    />,
  );
  return screen.getByText("answer");
}

describe("the answer button says what actually happened", () => {
  it("a backlog message is not described as dropped by the gate", () => {
    const btn = mount(msg({ dropReason: "asked before you attached" }));
    const title = btn.getAttribute("title") ?? "";
    expect(title).toContain("before you attached");
    expect(title, "the gate never judged this message").not.toContain("the gate dropped");
  });

  it("a message the gate really did drop still says so", () => {
    const btn = mount(msg({ dropReason: "reaction, not a question" }));
    expect(btn.getAttribute("title")).toContain("the gate dropped");
  });

  it("and one with no reason at all keeps the general wording", () => {
    expect(mount(msg({})).getAttribute("title")).toContain("the gate dropped");
  });
});
