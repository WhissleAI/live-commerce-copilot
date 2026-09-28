/// <reference types="vite/client" />

/**
 * Declared, not indexed, on purpose. `noPropertyAccessFromIndexSignature` is on,
 * so without these names the only way to read an env var is
 * `import.meta.env["VITE_USE_MOCKS"]` — and Vite only substitutes the literal
 * for *dot* access. Bracket access survives the build as a runtime lookup, which
 * leaves `USE_MOCKS` un-foldable and drags the whole scripted mock stream into
 * the production bundle. Naming them here buys dot access, which buys the fold.
 */
interface ImportMetaEnv {
  /** Backend origin. Absent in dev, where the default localhost:8790 applies. */
  readonly VITE_API_BASE?: string;
  /** "true" runs the console off the scripted stream instead of the backend. */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
