/**
 * The client against a stubbed server.
 *
 * Every endpoint here is being written in parallel with this file, so what is
 * worth asserting is not the happy path — it is what the client does when the
 * server answers in a shape it did not expect, or does not answer at all. A
 * destination whose whole point is "these are yours to send" must show what it
 * has rather than a stack trace for what it has not.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, surfaceUnavailable, type ApiError } from "./api";

type Reply = { status?: number; body: unknown };
let routes: Record<string, Reply>;
/** Every URL the client actually asked for. An endpoint it must NOT read is
 *  only provable by looking at what it read. */
let asked: string[];

const calls = (): string[] => asked;

function jsonResponse(r: Reply): Response {
  const status = r.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(r.body)),
    json: () => Promise.resolve(r.body),
  } as unknown as Response;
}

beforeEach(() => {
  routes = {};
  asked = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      asked.push(String(input));
      const path = new URL(input, "http://backend.test").pathname;
      const r = routes[path];
      if (!r) return Promise.resolve(jsonResponse({ status: 404, body: { error: "no route" } }));
      return Promise.resolve(jsonResponse(r));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api.surfaces", () => {
  it("reads the server's envelope and folds it over the built-in table", async () => {
    routes["/api/surfaces"] = {
      body: {
        surfaces: [
          {
            id: "reddit",
            label: "Reddit",
            capabilities: {
              tempo: "async",
              delivery: "draft-only",
              perception: { audio: false, video: false },
              actions: ["post_reply"],
              corpora: ["community"],
              communityRules: true,
            },
            attachable: true,
          },
        ],
      },
    };
    const rows = await api.surfaces();
    // Every surface is present, not only the one the server listed.
    expect(rows.length).toBeGreaterThan(1);
    const reddit = rows.find((r) => r.id === "reddit");
    expect(reddit?.attachable).toBe(true);
    expect(reddit?.capabilities.delivery).toBe("draft-only");
    expect(rows.find((r) => r.id === "ebaylive")?.capabilities.tempo).toBe("live");
  });

  it("falls back to the table when the endpoint is not there yet", async () => {
    const rows = await api.surfaces();
    expect(rows.find((r) => r.id === "ebaylive")?.capabilities.corpora).toContain("listing");
    // Nothing is attachable on a server that never told us what is wired.
    expect(rows.every((r) => r.attachable === false)).toBe(true);
  });
});

describe("api.drafts", () => {
  /** One follow-up and one Reddit draft, as the queue sends them. */
  const queue = {
    surface: null,
    status: null,
    waiting: {
      total: 2,
      bySurface: [
        { surface: "reddit", count: 1 },
        { surface: "dm", count: 1 },
      ],
    },
    drafts: [
      {
        id: "f_1",
        surface: "dm",
        origin: { kind: "session", id: "ebay_1", label: "Friday Night Grails — Ep. 42" },
        room: "Friday Night Grails — Ep. 42",
        sessionId: "ebay_1",
        question: {
          author: "buyer42",
          text: "still have the 10?",
          at: "2026-09-18T09:00:00.000Z",
          url: null,
        },
        draft: "We do.",
        createdAt: "2026-09-18T09:00:00.000Z",
        status: "open",
        sentAt: null,
      },
      {
        id: "d_1",
        surface: "reddit",
        origin: { kind: "room", id: "r/mechmarket", label: "r/mechmarket" },
        room: "r/mechmarket",
        sessionId: "s_reddit",
        question: { author: "u/buyer", text: "?", at: "2026-09-17T09:00:00.000Z", url: null },
        draft: "…",
        createdAt: "2026-09-17T09:00:00.000Z",
        status: "open",
        sentAt: null,
      },
    ],
  };

  it("reads the envelope and takes the server's waiting count whole", async () => {
    routes["/api/drafts"] = { body: queue };
    const q = await api.drafts();
    expect(q.drafts.map((d) => d.id)).toEqual(["f_1", "d_1"]);
    // Deep-equal to `/api/home` → now.drafts by construction, ordering and all.
    expect(q.waiting).toEqual(queue.waiting);
  });

  /**
   * The bug this replaced.
   *
   * `/api/drafts` did not exist, so the client read it, swallowed the 404, and
   * merged `/api/followups` in itself. Follow-ups are INSIDE the queue now, so
   * that merge would return every one of them twice — once from the queue and
   * once from the inbox the queue already contains — and the page would say
   * three waiting where home said two.
   */
  it("does not read the follow-up inbox at all, so nothing is counted twice", async () => {
    routes["/api/drafts"] = { body: queue };
    routes["/api/followups"] = {
      body: {
        followups: [
          {
            id: "f_1",
            showId: "ebay_1",
            buyer: "buyer42",
            question: "still have the 10?",
            draft: "We do.",
            status: "draft",
            createdAt: "2026-09-18T09:00:00.000Z",
            sentAt: null,
          },
        ],
      },
    };
    const q = await api.drafts();
    expect(q.drafts).toHaveLength(2);
    expect(q.drafts.filter((d) => d.id === "f_1")).toHaveLength(1);
    expect(q.waiting.total).toBe(2);
    expect(calls().some((u) => u.includes("/api/followups"))).toBe(false);
  });

  it("passes the filters through, and the filters never touch the count", async () => {
    routes["/api/drafts"] = {
      body: { ...queue, surface: "reddit", drafts: [queue.drafts[1]] },
    };
    const q = await api.drafts({ surface: "reddit", status: "open" });
    expect(calls().some((u) => u.includes("surface=reddit") && u.includes("status=open"))).toBe(
      true,
    );
    expect(q.drafts).toHaveLength(1);
    expect(q.waiting.total).toBe(2);
  });

  it("synthesises an origin rather than printing undefined where a room goes", async () => {
    routes["/api/drafts"] = {
      body: {
        drafts: [
          {
            id: "d_2",
            surface: "reddit",
            room: "r/watchexchange",
            question: { author: "u/x", text: "?", at: "2026-09-17T09:00:00.000Z" },
            draft: "…",
            createdAt: "2026-09-17T09:00:00.000Z",
          },
        ],
      },
    };
    const q = await api.drafts();
    expect(q.drafts[0]!.origin).toEqual({
      kind: "room",
      id: "r/watchexchange",
      label: "r/watchexchange",
    });
    // No envelope, so the heading is counted from what arrived rather than
    // left blank.
    expect(q.waiting.total).toBe(1);
  });

  it("shows nothing rather than throwing when the endpoint does not answer", async () => {
    const q = await api.drafts();
    expect(q.drafts).toEqual([]);
    expect(q.waiting).toEqual({ total: 0, bySurface: [] });
  });
});

describe("api.rooms", () => {
  it("reads the envelope the server actually sends", async () => {
    routes["/api/surfaces/reddit/rooms"] = {
      body: {
        surface: "reddit",
        rooms: [
          {
            surface: "reddit",
            room: "r/mechmarket",
            posting: false,
            disclosure: null,
            addedAt: "2026-09-10T00:00:00.000Z",
          },
        ],
      },
    };
    const rooms = await api.rooms("reddit");
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.posting).toBe(false);
  });

  it("reads a bare array too, and anything else as empty", async () => {
    routes["/api/surfaces/twitch/rooms"] = { body: [] };
    await expect(api.rooms("twitch")).resolves.toEqual([]);
    routes["/api/surfaces/twitch/rooms"] = { body: { nothing: true } };
    await expect(api.rooms("twitch")).resolves.toEqual([]);
  });
});

describe("api.persona", () => {
  it("keeps the persona and its corpus apart, the way the server does", async () => {
    routes["/api/persona"] = {
      body: {
        persona: { id: "default", name: "The Denim Vault", about: "", voice: "" },
        voice: {
          total: 12,
          docs: [
            {
              factId: "persona:1",
              question: "q",
              text: "t",
              origin: "sent",
              showId: null,
              showTitle: null,
              at: null,
            },
          ],
        },
      },
    };
    const view = await api.persona();
    expect(view.persona?.name).toBe("The Denim Vault");
    expect(view.voice.total).toBe(12);
    expect(view.voice.docs).toHaveLength(1);
  });

  it("reads a 404 as an empty state rather than an error", async () => {
    routes["/api/persona"] = { status: 404, body: { error: "no persona" } };
    const view = await api.persona();
    expect(view.persona).toBeNull();
    expect(view.voice).toEqual({ total: 0, docs: [] });
  });

  it("survives a payload with no voice block at all", async () => {
    routes["/api/persona"] = { body: { persona: { name: "x" } } };
    const view = await api.persona();
    expect(view.voice).toEqual({ total: 0, docs: [] });
  });
});

describe("api.learnPersona", () => {
  it("reads the count under either of the two names it has had", async () => {
    routes["/api/persona/learn"] = {
      body: {
        total: 30,
        indexed: 4,
        shows: [{ showId: "s1", title: "Tuesday drop", count: 4 }],
        pasted: 0,
      },
    };
    const r = await api.learnPersona();
    expect(r.indexed).toBe(4);
    expect(r.shows[0]?.title).toBe("Tuesday drop");

    routes["/api/persona/learn"] = { body: { learned: 7 } };
    expect((await api.learnPersona()).indexed).toBe(7);
  });
});

describe("surfaceUnavailable", () => {
  it("names the variable a 409 was about", () => {
    const e = Object.assign(new Error("twitch: TWITCH_CLIENT_ID is not set"), {
      status: 409,
      code: "surface-unavailable",
      body: { surface: "twitch", missing: "TWITCH_CLIENT_ID" },
    }) as ApiError;
    expect(surfaceUnavailable(e)).toEqual({
      surface: "twitch",
      missing: "TWITCH_CLIENT_ID",
      message: "twitch: TWITCH_CLIENT_ID is not set",
    });
  });

  // The console must not claim to know which key is missing when nobody said.
  it("is null for a 409 that is about something else", () => {
    const e = Object.assign(new Error("prepare the agent for this show first"), {
      status: 409,
      code: "prepare-first",
      body: { code: "prepare-first" },
    }) as ApiError;
    expect(surfaceUnavailable(e)).toBeNull();
  });

  it("is null for anything that is not a 409, and for nothing at all", () => {
    expect(surfaceUnavailable(Object.assign(new Error("x"), { status: 500 }))).toBeNull();
    expect(surfaceUnavailable(undefined)).toBeNull();
  });
});

describe("a refusal", () => {
  it("keeps the server's sentence, its status and its body", async () => {
    routes["/api/settings"] = { status: 403, body: { error: "you cannot write here", code: "ro" } };
    const err = await api.settings().catch((e: ApiError) => e);
    expect((err as ApiError).message).toBe("you cannot write here");
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).code).toBe("ro");
  });
});
