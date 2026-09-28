import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vite substitutes the literal value only for *dot* access on `import.meta.env`.
 * `import.meta.env["VITE_USE_MOCKS"]` survives the build as a runtime lookup, so
 * `USE_MOCKS` never folds to `false`, so Rollup cannot drop the `USE_MOCKS ? …`
 * branches, so the entire scripted mock stream ships to production — which it
 * did, in the chunk every page loads, landing page included. It cost 8.8 KB
 * gzipped and left a build-time env slip one variable away from serving a
 * fully fake console that looks real.
 *
 * `noPropertyAccessFromIndexSignature` is what pushes people to brackets here;
 * `src/vite-env.d.ts` names the variables so dot access typechecks instead.
 */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(entry) && !entry.endsWith(".d.ts") ? [path] : [];
  });

describe("import.meta.env is read by dot access", () => {
  it("has no bracket access anywhere in src", () => {
    const offenders = walk(join(import.meta.dirname, ".."))
      .filter((path) => !path.endsWith("env-access.spec.ts"))
      .filter((path) => /import\.meta\.env\s*\[/.test(readFileSync(path, "utf8")));

    expect(offenders).toEqual([]);
  });
});
