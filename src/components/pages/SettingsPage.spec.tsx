import { describe, expect, it } from "vitest";
import { GUARD_ROWS } from "./SettingsPage";
import { GUARD_LABEL } from "@/lib/format";
import type { GuardName } from "@/lib/types";

// The Guardrails tab is where an operator finds out what protects them, and it
// documented six of the eight guards that actually run. The two it left out —
// the room's rules and a sponsor's brief — are the ones an operator is least
// likely to guess at, because they did not write them and cannot change them
// here. `runChain` maps over every guard unconditionally; the surface-dependent
// part is only which PILLS the console draws.

describe("the Guardrails tab documents the chain", () => {
  it("has a row for every guard the product runs", () => {
    const documented = new Set(GUARD_ROWS.map((r) => r.guard));
    const inChain = Object.keys(GUARD_LABEL) as GuardName[];
    const missing = inChain.filter((g) => !documented.has(g));
    expect(missing).toEqual([]);
  });

  it("documents no guard that does not exist", () => {
    const inChain = new Set(Object.keys(GUARD_LABEL));
    expect(GUARD_ROWS.filter((r) => !inChain.has(r.guard)).map((r) => r.guard)).toEqual([]);
  });

  it("names each one once", () => {
    expect(new Set(GUARD_ROWS.map((r) => r.guard)).size).toBe(GUARD_ROWS.length);
  });

  it("says what each one checks", () => {
    for (const r of GUARD_ROWS) {
      expect(r.checks.length, `${r.guard} has no description`).toBeGreaterThan(30);
      expect(r.name.length, `${r.guard} has no label`).toBeGreaterThan(0);
    }
  });
});
