/**
 * A router for a spec that renders a screen containing `Link`s.
 *
 * `Link` reads the router out of context and throws on a null one, so a
 * component that navigates cannot be rendered bare. Every href in the app is a
 * real destination and asserting on it is the point of several specs here — so
 * the specs get a real router over a memory history rather than components
 * rewritten to emit dead anchors for the benefit of the test.
 */
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

export async function renderWithRouter(ui: ReactNode) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const index = createRoute({ getParentRoute: () => root, path: "/", component: () => <>{ui}</> });
  const rest = createRoute({ getParentRoute: () => root, path: "$", component: () => null });
  const router = createRouter({
    routeTree: root.addChildren([index, rest]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  // The provider resolves its first match asynchronously, so a bare `render`
  // returns an empty document and every query after it fails. Load once here
  // rather than making each spec chase the same `findBy`.
  await router.load();
  return render(<RouterProvider router={router as never} />);
}
