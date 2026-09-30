/**
 * The menu opened and left you standing outside it.
 *
 * The autonomy ladder handles ArrowDown/ArrowUp on the menu element rather than
 * on the document — correct, but it means the keys only fire once focus is
 * inside the menu, and nothing put it there. A keyboard user who pressed Enter
 * on the trigger got a menu in front of them, focus still on the trigger behind
 * it, and no way in but Tab.
 *
 * On the control that decides what the copilot may do without a human, that is
 * the wrong place to make someone guess.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AutonomyLadder } from "./TopBar";

describe("the autonomy menu takes focus when it opens", () => {
  function openMenu() {
    const trigger = screen.getAllByRole("button")[0]!;
    fireEvent.click(trigger);
    return trigger;
  }

  it("focuses the level currently in force, not the first one", () => {
    render(<AutonomyLadder level="L2_ONE_TAP" onChange={() => {}} />);
    openMenu();
    const active = document.activeElement as HTMLElement;
    expect(active.getAttribute("role")).toBe("menuitemradio");
    expect(active.getAttribute("aria-checked")).toBe("true");
  });

  it("so the arrow keys, which are handled on the menu, actually fire", () => {
    render(<AutonomyLadder level="L2_ONE_TAP" onChange={() => {}} />);
    openMenu();
    const before = document.activeElement;
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).not.toBe(before);
    expect((document.activeElement as HTMLElement).getAttribute("role")).toBe("menuitemradio");
  });

  it("hands focus back to the trigger when it closes", () => {
    render(<AutonomyLadder level="L2_ONE_TAP" onChange={() => {}} />);
    const trigger = openMenu();
    expect(document.activeElement).not.toBe(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement, "focus was dropped on <body>").toBe(trigger);
  });

  it("does not steal focus while it is closed", () => {
    render(<AutonomyLadder level="L2_ONE_TAP" onChange={() => {}} />);
    expect(document.activeElement).toBe(document.body);
  });
});
