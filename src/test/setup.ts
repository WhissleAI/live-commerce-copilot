import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Every spec renders into the same document. Without this the second render of
// a component finds two copies of its own heading and the assertion that was
// meant to be about one of them silently becomes about both.
afterEach(cleanup);
