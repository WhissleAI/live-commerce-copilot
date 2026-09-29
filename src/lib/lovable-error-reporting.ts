import { apiUrl, authHeader } from "./api";
import { BUILD_ID } from "@/generated/buildId";

type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  track?: (event: string, properties?: Record<string, unknown>) => string | null;
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

/**
 * Tell the server, because in production nothing else is listening.
 *
 * The two `window.__lovable*` hooks below are injected by the Lovable editor and
 * are undefined on the deployed site — verified: no `lovable` script in the HTML
 * of `/` or `/console`. So every error this function was handed in production was
 * discarded, including from the per-panel console boundary whose whole job is to
 * keep one panel's failure from blanking a seller's screen mid-show. The console
 * degraded correctly and told nobody.
 *
 * `POST /api/client-error` writes it into `session_events`, beside the backend's
 * own failures, so one timeline holds both halves of a session. Fire-and-forget
 * and silent on failure by design: a reporter that throws inside an error
 * boundary turns a broken panel into a broken page, and a seller cannot act on
 * "we could not report the thing that went wrong".
 *
 * `keepalive` so a report survives the unload that an error often precedes.
 */
function tellTheServer(kind: string, error: unknown, context: Record<string, unknown>): void {
  const message =
    error instanceof Response
      ? `Response ${error.status}`
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
  try {
    void fetch(apiUrl("/api/client-error"), {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", ...authHeader() },
      body: JSON.stringify({
        kind,
        // Which panel, when a panel boundary caught it.
        where: typeof context["panel"] === "string" ? context["panel"] : undefined,
        route: window.location.pathname,
        err: message,
        build: BUILD_ID,
      }),
    }).catch(() => {});
  } catch {
    /* a reporter must never be the reason a page fails */
  }
}

export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  tellTheServer(
    context["boundary"] === "console_panel" ? "panel" : "route",
    error,
    context,
  );
  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  // Prod React does not rethrow boundary-caught errors to window.onerror, so the
  // editor's telemetry never sees them. Forward to lovable.js's reporting hook,
  // which is present only inside the editor preview.
  // Loaders and server fns commonly throw a raw Response; String(it) is the
  // opaque "[object Response]", so pull out the status and URL instead.
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  window.__lovableReportRuntimeError?.({
    message,
    ...(stack !== undefined && { stack }),
    filename: window.location.pathname,
  });
}
