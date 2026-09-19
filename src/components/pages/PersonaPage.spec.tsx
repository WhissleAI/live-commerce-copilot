import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CorpusRow, ListEditor, RegisterRow, emptyPersona, mergePersona } from "./PersonaPage";
import type { Persona, PersonaRegister } from "@/lib/types";

const noop = () => {};

describe("mergePersona", () => {
  it("fills in every field the server did not send", () => {
    const p = mergePersona({ name: "The Denim Vault" } as Persona);
    expect(p.about).toBe("");
    expect(p.boundaries.never_claim).toEqual([]);
    expect(p.boundaries.must_disclose).toEqual([]);
    expect(p.registers).toEqual({});
  });

  // The empty state: nobody has written one, and the page must show a form
  // rather than invented copy.
  it("reads a missing persona as an empty one, not as a failure", () => {
    expect(mergePersona(null)).toEqual(emptyPersona());
    expect(mergePersona(undefined)).toEqual(emptyPersona());
  });

  it("keeps a half-filled boundaries object rather than dropping it", () => {
    const p = mergePersona({
      name: "x",
      boundaries: { never_claim: ["guaranteed authentic"] },
    } as unknown as Persona);
    expect(p.boundaries.never_claim).toEqual(["guaranteed authentic"]);
    expect(p.boundaries.never_discuss).toEqual([]);
  });
});

describe("ListEditor", () => {
  it("shows an honest empty line rather than a blank box", () => {
    render(<ListEditor title="Never claim" hint="…" placeholder="x" items={[]} onChange={noop} />);
    expect(screen.getByText("None — nothing is enforced for this yet.")).toBeInTheDocument();
  });

  it("adds on Enter and refuses a duplicate", () => {
    const seen: string[][] = [];
    render(
      <ListEditor
        title="Never claim"
        hint="…"
        placeholder="x"
        items={["guaranteed authentic"]}
        onChange={(l) => seen.push(l)}
      />,
    );
    const input = screen.getByLabelText("Add to Never claim");
    fireEvent.change(input, { target: { value: "deadstock" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(seen).toEqual([["guaranteed authentic", "deadstock"]]);

    fireEvent.change(input, { target: { value: "guaranteed authentic" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(seen).toHaveLength(1);
  });

  it("removes the item the bin belongs to", () => {
    const seen: string[][] = [];
    render(
      <ListEditor
        title="Never discuss"
        hint="…"
        placeholder="x"
        items={["a", "b"]}
        onChange={(l) => seen.push(l)}
      />,
    );
    fireEvent.click(screen.getByLabelText("Remove b"));
    expect(seen).toEqual([["a"]]);
  });
});

describe("RegisterRow", () => {
  it("says a surface with no register uses the voice above", () => {
    render(<RegisterRow surface="reddit" register={null} onChange={noop} />);
    expect(screen.getByText("Set a register")).toBeInTheDocument();
    expect(screen.queryByLabelText("Reddit length")).not.toBeInTheDocument();
  });

  it("names what the surface is, so the register is set against something real", () => {
    render(<RegisterRow surface="reddit" register={null} onChange={noop} />);
    expect(screen.getByText("Reddit")).toBeInTheDocument();
    expect(screen.getByText("async")).toBeInTheDocument();
    expect(screen.getByText("draft-only")).toBeInTheDocument();
  });

  it("does not call a live surface draft-only", () => {
    render(<RegisterRow surface="ebaylive" register={null} onChange={noop} />);
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.queryByText("draft-only")).not.toBeInTheDocument();
  });

  it("edits length, formality, emoji and notes", () => {
    const seen: (PersonaRegister | null)[] = [];
    const r: PersonaRegister = { length: "short", formality: 3, emoji: false, notes: "" };
    render(<RegisterRow surface="reddit" register={r} onChange={(x) => seen.push(x)} />);

    fireEvent.change(screen.getByLabelText("Reddit length"), { target: { value: "medium" } });
    fireEvent.change(screen.getByLabelText("Reddit formality"), { target: { value: "5" } });
    fireEvent.click(screen.getByLabelText("Reddit emoji"));
    expect(seen).toEqual([
      { ...r, length: "medium" },
      { ...r, formality: 5 },
      { ...r, emoji: true },
    ]);
  });

  it("clears the register back to null when asked to use the voice above", () => {
    const seen: (PersonaRegister | null)[] = [];
    render(
      <RegisterRow
        surface="reddit"
        register={{ length: "short", formality: 3, emoji: false, notes: "" }}
        onChange={(x) => seen.push(x)}
      />,
    );
    fireEvent.click(screen.getByText("Use the voice above"));
    expect(seen).toEqual([null]);
  });
});

describe("CorpusRow", () => {
  it("shows the question as well as the answer, and where it came from", () => {
    render(
      <CorpusRow
        doc={{
          factId: "persona:doc_9",
          question: "do you ship to the EU?",
          text: "Ships from Lisbon, usually out the same day.",
          origin: "sent",
          showId: "ebay_1",
          showTitle: "Tuesday denim drop",
          at: "2026-03-04T10:00:00.000Z",
        }}
      />,
    );
    expect(screen.getByText("do you ship to the EU?")).toBeInTheDocument();
    expect(screen.getByText("Tuesday denim drop")).toBeInTheDocument();
  });

  it("degrades to a plain line when the session it came from is gone", () => {
    render(
      <CorpusRow
        doc={{
          factId: "persona:doc_10",
          question: "",
          text: "…",
          origin: "sent",
          showId: null,
          showTitle: null,
          at: null,
        }}
      />,
    );
    expect(screen.getByText("a session of yours")).toBeInTheDocument();
  });

  it("says when the operator pasted it in themselves", () => {
    render(
      <CorpusRow
        doc={{
          factId: "persona:doc_11",
          question: "",
          text: "…",
          origin: "pasted",
          showId: null,
          showTitle: null,
          at: null,
        }}
      />,
    );
    expect(screen.getByText("pasted in")).toBeInTheDocument();
  });
});
