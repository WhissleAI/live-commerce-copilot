/**
 * The test runner, kept deliberately apart from `vite.config.ts`.
 *
 * That file is `@lovable.dev/vite-tanstack-config`, which composes the whole
 * Start toolchain — the router plugin, nitro, the devtools — and none of it is
 * wanted here: a spec renders one component into jsdom and asks what it drew.
 * Booting the router plugin to do that would make the suite depend on the build
 * pipeline it exists to protect.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: false,
    globalSetup: ["./src/test/buildId.setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
    // Mocks are opt-in in the app and must be OFF here, or every api spec would
    // assert against the scripted driver rather than against the client.
    env: { VITE_USE_MOCKS: "false", VITE_API_BASE: "http://backend.test" },
  },
});
