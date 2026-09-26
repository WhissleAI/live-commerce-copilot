/**
 * Make sure the generated build stamp exists before anything imports it.
 *
 * `src/generated/buildId.ts` is written by `scripts/build-id.mjs` at build
 * time and is not in the repo — correctly, it is a build artifact. But
 * `AppShell` imports it, so on a fresh clone `npx vitest run` fails to RESOLVE
 * five spec files before running a line of them, and reports "14 passed" with
 * no hint that a quarter of the suite never loaded. A green-looking run that
 * silently skipped five files is worse than a red one.
 *
 * `npm test` gets this from `pretest`; this covers `npx vitest run`, which is
 * what the README and everyone's muscle memory actually type.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

export default function setup() {
  if (existsSync("src/generated/buildId.ts")) return;
  mkdirSync("src/generated", { recursive: true });
  writeFileSync("src/generated/buildId.ts", `export const BUILD_ID = "test";\n`);
}
