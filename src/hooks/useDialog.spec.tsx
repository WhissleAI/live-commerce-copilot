/**
 * CONTENT-40. Six dialogs set `role="dialog"` and then did none of the three
 * things that makes one: focus nothing on open, let Tab walk the page behind
 * them, and drop focus on `<body>` when they closed. `DeleteShowDialog` was
 * the worst — a destructive confirmation whose confirm button was several
 * Tabs away behind whatever had focus before it opened.
 */

import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useDialog } from "./useDialog";

function Harness({ initial }: { initial?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  useDialog(ref, open, initial);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <button type="button">behind</button>
      {open ? (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="A dialog">
          <button type="button">first</button>
          <button type="button" data-dialog-initial>
            safe
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            last
          </button>
        </div>
      ) : null}
    </>
  );
}

describe("useDialog", () => {
  it("focuses the first control when it opens", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("open"));
    expect(document.activeElement).toBe(screen.getByText("first"));
  });

  it("lets a destructive dialog name a safer initial target", () => {
    render(<Harness initial="[data-dialog-initial]" />);
    fireEvent.click(screen.getByText("open"));
    expect(document.activeElement).toBe(screen.getByText("safe"));
  });

  it("wraps Tab from the last control back to the first", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("open"));
    screen.getByText("last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("first"));
  });

  it("wraps Shift+Tab from the first control back to the last", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("open"));
    screen.getByText("first").focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText("last"));
  });

  it("pulls focus back in if it is outside the dialog", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("open"));
    screen.getByText("behind").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("first"));
  });

  it("gives focus back to whatever opened it", () => {
    render(<Harness />);
    const opener = screen.getByText("open");
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).not.toBe(opener);
    fireEvent.click(screen.getByText("last"));
    expect(document.activeElement).toBe(opener);
  });

  it("does nothing at all while closed", () => {
    render(<Harness />);
    const behind = screen.getByText("behind");
    behind.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(behind);
  });
});
