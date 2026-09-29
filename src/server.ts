import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * The path a 500 happened on, and nothing else from the URL.
 *
 * The pathname alone, deliberately: a query string can carry a token, an email
 * or a show id, and a log line is the last place those should be durable. The
 * path is what a reader needs — it is currently the one thing a 500 in the log
 * does not say.
 */
function whereItFailed(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "(unparsable url)";
  }
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  // The recovered stack is read from module state, so it is the LAST error any
  // code passed to console.error — not provably this request's. Two SSR
  // failures inside the 5s window and the second line can carry the first's
  // stack. The path is what makes that visible: a stack that cannot be reached
  // from the page named beside it is a misattribution, and without the path
  // there is no way to tell. Correlating properly needs request-scoped storage,
  // and `node:async_hooks` is not safely available on every runtime this builds
  // for (nitro's default target here is cloudflare) — so this says what it
  // knows instead of pretending to know more.
  console.error(
    `SSR 500 on ${whereItFailed(request)}`,
    consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
  );
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, request);
    } catch (error) {
      // This one IS this request's error — it was thrown here. It was still
      // logged without a path.
      console.error(`SSR threw on ${whereItFailed(request)}`, error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
