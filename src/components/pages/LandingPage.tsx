/**
 * The front door — what a visitor sees before they have an account.
 *
 * Built from the Figma landing (SideStage — Brand, Landing & Design Template ·
 * 02 · Landing page), section for section, with the same claims: measured
 * numbers with their caveats attached, the limits stated before anyone asks,
 * and the one moment the product exists for — a wrong answer, blocked — above
 * the fold. Nothing on this page says something the app does not do.
 *
 * It is organised the way the product is: a conversation is answered on a
 * SURFACE, and it passes through three PHASES. The page opened on one eBay Live
 * show for as long as that was the whole product; it answers in four kinds of
 * room now, and a hero that names one of them is a hero that is wrong about the
 * rest. Two rules keep the retelling honest:
 *
 *  · Every surface claim was read out of the backend before it was written
 *    here, and the ones the code does not support are said as limits rather
 *    than left out — a key that is not set, an action that is tested but not
 *    wired, a surface that is off behind a flag.
 *  · The claim the page would most like to fudge is who sends the reply.
 *    Nobody but the operator does, anywhere. `NOT_THE_SENDER` says it once and
 *    a spec holds every card to it, so no section can imply otherwise.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { LogoLockup } from "@/components/brand/Logo";
import { SURFACE_LABEL, capabilitiesOf, draftOnly } from "@/lib/surfaces";
import type { SurfaceId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The sections the nav points at, in page order. */
const NAV = [
  ["surfaces", "Surfaces"],
  ["phases", "How it works"],
  ["guardrails", "Guardrails"],
  ["autonomy", "Autonomy"],
  ["price", "Price"],
] as const;
const HEADER = 68;

const motion = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/**
 * Scroll to a section in place. Never touches the URL — a hash in the bar
 * reads as a page change, and the back button then reads as broken — and
 * never relies on anchor default behaviour, which the router may intercept.
 * The body is `overflow: hidden` for the console shell, so the landing owns
 * its own scroll container; scrollIntoView finds it, and the sections'
 * scroll-margin keeps the sticky header off the heading.
 */
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: motion(), block: "start" });
  // CONTENT-41: it scrolled and stopped there, so focus stayed on the nav
  // button and the next Tab went to the next nav button rather than into the
  // section that had just been jumped to. For a keyboard user the nav moved
  // the page and nothing else — decoration. `tabIndex={-1}` makes the section
  // focusable without adding a tab stop; `preventScroll` keeps the smooth
  // scroll that is already running.
  el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}

/** Which section is under the header right now, for the nav's active state. */
function useActiveSection(root: React.RefObject<HTMLElement | null>): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = NAV.map(([id]) => document.getElementById(id)).filter((x): x is HTMLElement =>
      Boolean(x),
    );
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { root: root.current, rootMargin: `-${HEADER + 8}px 0px -60% 0px`, threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
  return active;
}

/**
 * Sections below the fold fade up once as they enter. Fail-safe by design:
 * everything is visible until JS proves it can animate (tab visible, motion
 * allowed, observer available), and a timer reveals whatever the observer
 * never reached — content is never parked invisible waiting on a callback.
 */
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const can =
      typeof IntersectionObserver !== "undefined" &&
      !document.hidden &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!can) return;
    const fold = window.innerHeight;
    const pending = els.filter((el) => el.getBoundingClientRect().top > fold);
    pending.forEach((el) => el.classList.add("pre"));
    const show = (el: Element) => {
      el.classList.remove("pre");
      el.classList.add("in");
    };
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show(e.target);
            io.unobserve(e.target);
          }
        }),
      { root: root.current, rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );
    pending.forEach((el) => io.observe(el));
    const safety = window.setTimeout(() => pending.forEach(show), 4000);
    const onHide = () => {
      if (document.hidden) pending.forEach(show);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      io.disconnect();
      window.clearTimeout(safety);
      document.removeEventListener("visibilitychange", onHide);
      pending.forEach(show);
    };
  }, [root]);
}

const DARK = "bg-[#0F1E1A] text-white";

// ── the surfaces strip ──────────────────────────────────────────────────────
//
// Four families, two tempos. The grouping is editorial — an operator thinks
// "streams" before "twitch" — but the tempo chip is read out of the shipped
// capability table, and `LandingPage.spec.tsx` holds every family the table
// calls draft-only to copy that says so. If Reddit is ever flipped to `api`,
// the spec is where that argument happens, not a marketing review.
//
// YouTube Live is deliberately absent. It has a row in the capability table and
// no adapter behind it, and a surface a visitor cannot use is not a surface.

export interface SurfaceFamily {
  id: string;
  title: string;
  surfaces: SurfaceId[];
  /** What the copilot does with a reply here. Always begins "drafts", on every
   *  surface, because that is where its part ends — see NOT_THE_SENDER. */
  delivery: string;
  /** What it does on these surfaces. */
  lead: string;
  /** The limit, said here rather than discovered later. */
  limit: string;
}

export const SURFACE_FAMILIES: SurfaceFamily[] = [
  {
    id: "commerce",
    title: "Live commerce",
    surfaces: ["ebaylive", "whatnot", "tiktoklive"],
    delivery: "drafts · proposes listing changes",
    lead: "It reads the same public page the buyer reads, resolves the lot on the block, and answers out of your own listings — then proposes the change the answer implies: a markdown, a stock correction, a listing ended.",
    limit:
      "eBay Live is the one that acts on listings: on a show you own, after a preflight, with a 90-second undo — and against a mock until you connect eBay and arm that show. Whatnot and TikTok Live are read the same way and draft only, and TikTok stays off until its own flag is set.",
  },
  {
    id: "streams",
    title: "Creator streams",
    surfaces: ["twitch"],
    delivery: "drafts · you connect it",
    lead: "Twitch chat, on a channel you connect with your own keys and an OAuth sign-in. Same reading, same drafting, same guards — a stream's chat is a room like any other.",
    limit:
      "Key-gated and not connected in production. Without the credentials the app names the variable it wants instead of hiding the surface. The stream's own actions — a clip, a poll, a pinned message — are written and tested against Twitch's API and not yet wired into the running app, so this page will not sell them to you.",
  },
  {
    id: "communities",
    title: "Communities",
    surfaces: ["reddit"],
    delivery: "drafts · you post",
    lead: "It watches the subreddits you choose, reads a question with the branch of the thread above it, and writes the reply you would have written — against the same guards a live show uses.",
    limit:
      "Draft-only in the code, four times over: the capability says so, the action list contains no reply, preflight refuses one, and the Reddit client has no write path at all — its only POST mints an OAuth token. We never post to Reddit for you. You post it, under your own name.",
  },
  {
    id: "inbox",
    title: "Your follow-up inbox",
    surfaces: ["dm"],
    delivery: "drafts · you send",
    lead: "Everyone who asked during a show and did not buy is a question you still owe an answer to. When the show ends the inbox holds one written reply per person — re-checked against the catalog as it stands now, not as it stood then.",
    limit:
      "A follow-up the guards block is never written down at all, so everything waiting for you has already passed the chain. It skips anyone you settled with a committed change to the listing they asked about. You are the sender; marking it sent is your word, which is the only word there is.",
  },
];

/**
 * The line the whole page rests on, and the one it would be easiest to fudge.
 *
 * It used to read "on every surface", stated as an absolute — and the same
 * page then described a per-room posting switch four sections later, which is
 * a switch that exists: `RoomsPage` ships it, `surfaces/rooms.ts` persists the
 * flag, and `actions/preflight.ts` has a branch that would permit a
 * `post_reply` once it is on. An absolute the product's own settings page
 * contradicts is worse than a narrower claim, so this is the narrower claim,
 * and it is the one that is true of the code:
 *
 *   · Nothing is posted for anybody in this build. `post_reply` is never
 *     proposed — `actions/proposer.ts` does not produce it — and never
 *     executed: `actions/executor.ts` has no branch for it, and the one
 *     implementation that exists (`surfaces/twitch/actions.ts`) is imported
 *     by its own test and by nothing in `src/`.
 *   · `pipeline.send()` marks a reply `sent`, counts it and appends an audit
 *     entry. There is no platform call on any path.
 *   · Where a surface could post one day, the room switch is off by default
 *     and refuses to exist at all on a draft-only surface.
 *
 * Said here once, as a constant, so a section cannot quietly imply otherwise.
 */
export const NOT_THE_SENDER =
  "You are the sender. Nothing in this build posts a reply for you on any surface: the copilot reads, drafts, cites and checks, and a human puts the words in the room.";

/** live or async, read off the shipped capability table. */
export function tempoLabel(ids: SurfaceId[]): string {
  return ids.every((id) => capabilitiesOf(id).tempo === "async") ? "async" : "live";
}

/** Does the shipped table forbid us from delivering anywhere in this family? */
export function isDraftOnlyFamily(f: SurfaceFamily): boolean {
  return f.surfaces.every((id) => draftOnly(capabilitiesOf(id)));
}

export function FamilyCard({ f }: { f: SurfaceFamily }) {
  return (
    // Four cards side by side are one repeated object, so the rule above the
    // limit has to land on the same line in each. Leads differ by a sentence,
    // which floated it. At the four-across breakpoint every card borrows the
    // strip's own row tracks (subgrid), so meta, title, chips, lead and limit
    // share five baselines; narrower, the cards stack and it stops mattering.
    <div className="flex h-full flex-col rounded-lg bg-panel p-6 shadow-[0_0_0_1px_var(--hairline),0_10px_28px_-22px_rgba(0,0,0,.35)] xl:grid xl:row-span-5 xl:grid-rows-subgrid">
      <div className="flex items-center gap-2">
        <span className="num text-[11px] tracking-[0.04em] text-text-muted uppercase">
          {tempoLabel(f.surfaces)}
        </span>
        <span className="h-3 w-px bg-hairline" aria-hidden />
        <span className="num text-[11px] text-text-muted">{f.delivery}</span>
      </div>
      <p className="mt-3 text-[20px] font-semibold">{f.title}</p>
      <ul
        className="mt-3 flex flex-wrap content-start items-start gap-1.5"
        aria-label={`${f.title} surfaces`}
      >
        {f.surfaces.map((id) => (
          <li
            key={id}
            className="num rounded-sm bg-elevated px-2 py-0.5 text-[12px] text-text-secondary"
          >
            {SURFACE_LABEL[id]}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">{f.lead}</p>
      <p className="mt-4 border-t border-hairline pt-4 text-[14px] leading-relaxed text-text-muted">
        {f.limit}
      </p>
    </div>
  );
}

/** A real screenshot, framed. Every image on this page is a capture of the
 *  product or of eBay Live, never a mock — the caption says which. */
function Shot({
  src,
  alt,
  caption,
  className = "",
  eager = false,
}: {
  src: string;
  alt: string;
  caption?: React.ReactNode;
  className?: string;
  /** The hero shot is the page's largest paint and sits above the fold —
   *  deferring it leaves a grey rectangle in the first frame a visitor, a
   *  thumbnail and a link preview all get. Every shot below the fold stays
   *  lazy, which is what that attribute is actually for. */
  eager?: boolean;
}) {
  return (
    <figure className={className}>
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        {...(eager ? { fetchPriority: "high" as const } : {})}
        decoding="async"
        className="block w-full rounded-lg bg-canvas shadow-[0_0_0_1px_var(--hairline),0_10px_28px_-14px_rgba(0,0,0,.35)]"
      />
      {caption && (
        <figcaption className="mt-3 text-[13px] leading-relaxed text-text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * The stale-price race, exactly as `npm run demo:stale-price` prints it.
 *
 * CONTENT-10. This card used to depict a trucker jacket at $132.00 against an
 * expected $148.00, on listing v13, asked about by s_okafor — and then invited
 * the visitor to run the command, which prints an Air Jordan 1 at $412.00
 * against $370.00, on v2, asked about by @mia_k. Someone who took the page up
 * on its offer got a different item, different numbers and a different buyer
 * from the ones they had just read.
 *
 * Every figure below was copied out of a run of that command on 19 September
 * 2026. Nothing here is illustrative; if the demo changes, this card is wrong
 * and should be recaptured rather than adjusted.
 */
function MomentCard() {
  return (
    <div>
      <div className="overflow-hidden rounded-lg bg-canvas shadow-[0_1px_0_var(--hairline),0_12px_40px_-24px_rgba(0,0,0,.35)]">
        <div className="flex h-[42px] items-center gap-3 px-4 text-[12px] shadow-[0_1px_0_var(--hairline)]">
          <span className="flex items-center gap-1.5 font-semibold text-bad">
            <span className="anim-live size-[7px] rounded-full bg-bad" aria-hidden /> LIVE
          </span>
          <span className="num text-text-secondary">t+1.5s</span>
          <span className="ml-auto text-text-muted">@mia_k asked how much for the Chicagos</span>
        </div>
        <div className="bg-panel p-5">
          <p className="num text-[14px] font-medium">
            the seller marked it down 1.4 seconds ago — the listing is now v2
          </p>
          <p className="mt-3 text-[16px] text-text-muted line-through">
            Mia_k, the Chicago Reimagined AJ1 size 10 is $412.00.
          </p>
          <div className="mt-4 flex gap-3 rounded-md bg-bad/[0.07] px-3.5 py-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <div>
              <p className="text-[14px] font-semibold text-bad">Blocked by the price guard</p>
              <p className="num mt-0.5 text-[13px] text-text-secondary">
                expected $370.00 (v2) · found $412.00 (v1)
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Pill mark="✕" label="price" bad />
            <Pill mark="✓" label="stock" />
            <Pill mark="✓" label="policy" />
            <Pill mark="✓" label="grounding" />
            <Pill mark="✓" label="tone" />
            <Pill mark="✓" label="pii" />
          </div>
        </div>
        <div className="h-0.5 bg-hairline">
          <div className="h-full w-[61%] bg-bad" />
        </div>
      </div>
      <p className="mt-3.5 text-[13px] leading-relaxed text-text-muted">
        Two and a half seconds: the seller marked the lot down, the draft quoted the old price, the
        guard compared the fact&apos;s listing version against the live one and stopped it. Run it
        yourself: <span className="num">npm run demo:stale-price</span> — and read past the block,
        because the script then repairs the draft and sends it, which is a step the shipped pipeline
        does not have. A guard that asks for a revision aggregates to a block, so a blocked draft is
        held for you rather than re-written.
      </p>
    </div>
  );
}
const WRAP = "mx-auto w-full max-w-[1160px] px-6";

function Kicker({ children }: { children: string }) {
  return (
    <p className="text-[12px] font-medium tracking-[0.08em] text-text-muted uppercase">
      {children}
    </p>
  );
}
function H2({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h2
      className={`mt-3 font-[Archivo,Inter,sans-serif] text-[34px] leading-[1.08] font-bold tracking-[-0.02em] text-balance md:text-[40px] ${light ? "text-white" : ""}`}
    >
      {children}
    </h2>
  );
}
/** One phase's opening: its number, its name, and what it is for. */
function PhaseHead({
  n,
  label,
  title,
  lead,
}: {
  n: string;
  label: string;
  title: string;
  lead: React.ReactNode;
}) {
  return (
    <div>
      <p className="num text-[12px] font-medium text-bad">
        {n} — {label}
      </p>
      <h3 className="mt-3 font-[Archivo,Inter,sans-serif] text-[30px] leading-[1.1] font-bold tracking-[-0.02em] text-balance md:text-[34px]">
        {title}
      </h3>
      <p className="mt-4 text-[17px] leading-relaxed text-text-secondary">{lead}</p>
    </div>
  );
}

/**
 * What this phase means where there is no session — the half of the product a
 * page organised around shows keeps forgetting. Marked, not buried: an async
 * surface is not a live one with features missing.
 */
function TempoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 border-l-2 border-hairline-strong pl-5">
      <p className="num text-[11px] tracking-[0.08em] text-text-faint uppercase">
        without a session
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-text-muted">{children}</p>
    </div>
  );
}

/** The bullets under a phase. One rule each, no decoration. */
function Points({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-3 text-[16px] leading-relaxed text-text-secondary">
      {items.map((s, i) => (
        <li key={i} className="border-t border-hairline pt-3 first:border-0 first:pt-0">
          {s}
        </li>
      ))}
    </ul>
  );
}

function Pill({ mark, label, bad }: { mark: string; label: string; bad?: boolean }) {
  return (
    <span
      className={`num inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[12px] ${bad ? "bg-bad/12 text-bad" : "bg-ok/12 text-ok"}`}
    >
      {mark} {label}
    </span>
  );
}
function Primary({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex h-[52px] items-center gap-2 rounded-md bg-bad px-6 text-[15px] font-medium text-white hover:brightness-110"
    >
      {children}
    </Link>
  );
}
function Secondary({
  to,
  children,
  light,
}: {
  to: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex h-[52px] items-center rounded-md px-6 text-[15px] font-medium ${light ? "border border-white/30 text-white hover:bg-white/10" : "bg-elevated text-text hover:bg-hairline"}`}
    >
      {children}
    </Link>
  );
}

export function LandingPage() {
  const scroller = useRef<HTMLDivElement>(null);
  const active = useActiveSection(scroller);
  useReveal(scroller);
  return (
    <div ref={scroller} className="h-screen overflow-y-auto bg-panel text-text">
      {/* nav — stays put while the page scrolls, so a jump never looks like a page change */}
      <header className="sticky top-0 z-40 bg-panel/85 backdrop-blur-md shadow-[0_1px_0_var(--hairline)]">
        <div className={`${WRAP} flex h-[68px] items-center justify-between`}>
          <button
            type="button"
            onClick={() => scroller.current?.scrollTo({ top: 0, behavior: motion() })}
            aria-label="SideStage — top"
          >
            <LogoLockup size={26} />
          </button>
          <nav className="hidden items-center gap-7 text-[14px] text-text-secondary md:flex">
            {NAV.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => jumpTo(id)}
                aria-current={active === id ? "location" : undefined}
                className={cn(
                  "relative py-1 transition-colors hover:text-text",
                  active === id &&
                    "text-text after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-bad",
                )}
              >
                {label}
              </button>
            ))}
            <Link to="/login" className="hover:text-text">
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-md bg-text px-4 py-2.5 text-[14px] font-medium text-white hover:opacity-90"
            >
              Create an account
            </Link>
          </nav>
          <Link to="/login" className="text-[14px] md:hidden">
            Sign in
          </Link>
        </div>
      </header>

      {/* hero --------------------------------------------------------------- */}
      <section className={`${WRAP} grid gap-12 py-[92px] lg:grid-cols-[560px_1fr] lg:items-center`}>
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-bad/10 px-3 py-1.5 text-[12px] font-semibold tracking-[0.04em] text-bad">
            <span className="anim-live size-2 rounded-full bg-bad" aria-hidden /> ON AIR · AND IN
            THE THREAD
          </span>
          <h1 className="mt-6 font-[Archivo,Inter,sans-serif] text-[42px] leading-[1.04] font-bold tracking-[-0.025em] text-balance md:text-[52px]">
            It answers the room, wherever the room is. From what you actually know. You keep the
            last word.
          </h1>
          <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-text-secondary">
            SideStage is one copilot across a live show, a stream, a subreddit and your own
            follow-up inbox. It reads the conversation, answers out of your listings, your policies
            and every question you have already answered, names the fact it used, and runs six
            deterministic guards against the state as it stands right now. Then it hands the reply
            to you: nothing it writes reaches a buyer, a listing or a thread on its own.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Primary to="/register">
              Create an account <span className="text-[13px] opacity-80">free</span>
            </Primary>
            <Secondary to="/login">Sign in</Secondary>
          </div>
          <p className="mt-6 max-w-[528px] text-[13px] leading-relaxed text-text-muted">
            For the one person running the whole thing · read-only on any session you do not own ·
            draft-only where the room says so · a human approves every reply and every action, at
            every rung
          </p>
        </div>

        <Shot
          src="/landing/console.jpg"
          alt="The SideStage console attached to a live eBay Live watch auction: buyer chat on the left, drafted replies with guard verdicts in the middle, the pinned lot on the right"
          caption="The console on a real eBay Live show tonight — 558 watching, 19 replies drafted, 0 sent without you. A screenshot, not a mock."
          eager
        />
      </section>

      {/* proof band ----------------------------------------------------------- */}
      <section className={`${DARK} py-20`}>
        <div className={`${WRAP} grid gap-14 md:grid-cols-3`}>
          {[
            [
              "2.00s",
              "is the budget a drafted reply is measured against. We miss it.",
              "The p95 figure that belongs in this space was measured on an older build and no longer reproduces, so it is not quoted here — a stale number in the flattering direction is the exact failure this section promises not to commit. It is being re-measured. Until then the only p95 worth reading is your own: every breach is counted and shown on the session bar rather than averaged away.",
              "text-[#F5B84A]",
            ],
            [
              "$0.06",
              "a minute, measured once. Not a price.",
              "One omni-channel agent per session — it reads the chat, hears the host, sees the lot — metered by the minute, with the meter beside the queue while the session runs. This figure is one observation: $0.52 for nine minutes of a watch auction, and an upper bound at that, because the wallet it was measured against is shared across the workspace. Nothing in the product quotes a rate, and the meter you should read is your own.",
              "",
            ],
            [
              "6",
              "deterministic guards. A reply passes all six, or it is held.",
              "They are rules over the catalog as it stands right now, not a second model asked to be careful. The precision and recall this space used to quote came from our own labelled case suite and is not quoted while that suite is being re-measured against a change to the chain — and it proved internal consistency and not much else anyway, since the same person wrote the guards and the cases.",
              "",
            ],
          ].map(([n, lead, body, tone = ""]) => (
            <div key={n}>
              <p
                className={`num font-[Archivo,Inter,sans-serif] text-[52px] leading-none font-bold ${tone}`}
              >
                {n}
              </p>
              <p className="mt-4 text-[20px] leading-snug font-semibold">{lead}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* surfaces -------------------------------------------------------------- */}
      <section id="surfaces" data-reveal className="bg-canvas py-[112px]">
        <div className={WRAP}>
          <div className="grid gap-10 lg:grid-cols-[480px_1fr] lg:items-end">
            <div>
              <Kicker>Where it answers</Kicker>
              <H2>The same copilot, in four places that behave nothing alike.</H2>
            </div>
            <p className="text-[17px] leading-relaxed text-text-secondary lg:pb-1">
              A live show runs at the speed of the block: a question is worth answering for about as
              long as the lot is on it. A thread from Tuesday is still worth a real answer on
              Friday, and the person who asked during last week's show and left is worth one too.
              The copilot works at both speeds, out of the same ground truth, under the same guards.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-[auto_auto_auto_1fr_auto] xl:gap-y-0">
            {SURFACE_FAMILIES.map((f) => (
              <FamilyCard key={f.id} f={f} />
            ))}
          </div>
          <div className="mt-10 grid gap-8 rounded-lg bg-panel p-7 shadow-[0_0_0_1px_var(--hairline)] md:grid-cols-3">
            <div>
              <p className="text-[18px] font-semibold">Two tempos, one set of rules</p>
              <p className="mt-3 text-[16px] leading-relaxed text-text-secondary">
                A live surface gets a bounded session: attach, answer, end, report. An async surface
                has no session at all — a standing watch on the rooms you chose and a queue of
                drafts that is always open. Both go through the same retrieval, the same six guards,
                the same audit.
              </p>
            </div>
            <div>
              <p className="text-[18px] font-semibold">What is running today</p>
              <p className="mt-3 text-[16px] leading-relaxed text-text-secondary">
                eBay Live is the surface this was built on and the one we run, including its report
                and its follow-ups. Whatnot reads the same way. TikTok Live, Twitch and Reddit ship
                in the build behind their own credentials or their own flag — and the app names the
                variable it is missing rather than pretending the surface is broken.
              </p>
            </div>
            <div>
              <p className="text-[18px] font-semibold">Who sends it</p>
              <p className="mt-3 text-[16px] leading-relaxed text-text-secondary">
                {NOT_THE_SENDER} An approved reply is recorded, audited and handed back to you to
                copy. eBay Live publishes no chat-post API and the scraped surfaces have no send
                path by construction; Twitch&apos;s is written and tested against its API and is not
                wired into the app that runs. Rooms you do not own carry a posting switch that
                starts off, stays off until you turn it on for that room by name, and cannot be
                turned on at all where the surface is draft-only — and nothing in this build acts on
                it yet. That is a boundary we chose, not a feature we owe you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* who it is for --------------------------------------------------------- */}
      <section data-reveal className={`${WRAP} grid gap-12 py-[112px] lg:grid-cols-[440px_1fr]`}>
        <div>
          <Kicker>Who it is for</Kicker>
          <H2>One person, three jobs, four rooms.</H2>
          <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
            A brand's live show has a producer, a moderator and a merchandiser. You are all three,
            while holding the item up to a lens — and the questions do not stop when the show does.
          </p>
        </div>
        <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
          {[
            ["Questions scroll past", "Every one was a buyer who was close."],
            ["Edits land late", "The markdown, the sold-out lot, the wrong pin."],
            ["Fast answers go wrong", "A stale price is a refund tomorrow."],
            [
              "Then it all disappears",
              "The people who asked and left, the thread nobody went back to, and what your listings should have said.",
            ],
          ].map(([t, b]) => (
            <div key={t}>
              <p className="text-[20px] font-semibold">{t}</p>
              <p className="mt-2 text-[16px] leading-relaxed text-text-secondary">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* the three phases ------------------------------------------------------ */}
      {/* The spine of the page, and of the product: every conversation passes
          through the same three phases, and what fills them differs by tempo
          rather than by surface. Each one is anchored to a screenshot of the
          thing itself. */}
      <section id="phases" data-reveal className="bg-canvas py-[112px]">
        <div className={WRAP}>
          <div className="grid gap-10 lg:grid-cols-[520px_1fr] lg:items-end">
            <div>
              <Kicker>Before · during · after</Kicker>
              <H2>Three phases, everywhere. What fills them depends on the tempo.</H2>
            </div>
            <p className="text-[17px] leading-relaxed text-text-secondary lg:pb-1">
              A live show is prepared, worked and reported on. A subreddit has no session to prepare
              and no moment that ends, so the same three phases become a connection, a standing
              watch and a queue that empties. The retrieval, the guards and the audit are one
              implementation across both.
            </p>
          </div>

          {/* 01 — before ------------------------------------------------------- */}
          <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_520px] lg:items-start">
            <div>
              <PhaseHead
                n="01"
                label="before"
                title="It prepares, and tells you what it could not."
                lead="A session should not meet its first question with an empty catalog. Ahead of an eBay Live show the copilot resolves the seller, builds their catalog, gives the show its own agent, and grades its own readiness — out loud, item by item."
              />
              <div className="mt-8">
                <Points
                  items={[
                    "Reads what is live on eBay, resolves the seller behind the show, and builds a catalog of up to eighty of their own listings.",
                    "Values each lot against comparables that are asking prices, labelled as asking prices — eBay's completed-sales data is limited-release and this keyset was not granted it. The two are never averaged: asking prices skew high, and a seller holding firm against a number they think is a sale price is being misled.",
                    "Creates the show's own agent, syncs the lineup into its knowledge base with prices marked indicative, and arms the never-say rules on the agent itself.",
                    "Readiness is nine named checks — catalog, policy clauses, comps, the aspects eBay expects, the agent, its inventory, its policies, stale corpora, the rules armed — plus a fit check that catches a catalog belonging to a different auction. A policy it cannot find is never invented.",
                  ]}
                />
                <TempoNote>
                  Nothing to prepare and nothing to warm up. A community's before is the connection
                  and the rooms: you name the subreddits the copilot watches, and posting stays off
                  — on Reddit, permanently. Preparation in this sense is an eBay Live step today;
                  the other surfaces attach and start reading.
                </TempoNote>
              </div>
            </div>
            <Shot
              src="/landing/shows.jpg"
              alt="Home: readiness checks for the seller's own prepared show, beside a live eBay Live show available to attach"
              caption="Before: your own session, prepared and graded, next to what is on air now."
            />
          </div>

          {/* 02 — during ------------------------------------------------------- */}
          <div className="mt-24 grid gap-12 lg:grid-cols-[520px_1fr] lg:items-start">
            <div>
              <PhaseHead
                n="02"
                label="during"
                title="It reads the same page your buyers read."
                lead="No private API and no special access. It opens the public eBay Live player, reads the chat and the lot card as they render, hears you through a tab-audio bridge if you share it, and samples a frame off the camera. Every lot is versioned as the auction moves, so a reply can be checked against the state it was written for."
              />
              <div className="mt-8 grid gap-8 sm:grid-cols-2">
                {[
                  [
                    "perceive",
                    "Buyer chat, the lot card re-read as the block moves, a frame off the camera, and your own voice with emotion and intent kept as distributions. Audio needs one human click in Chrome — nothing here starts listening on its own.",
                  ],
                  [
                    "ground",
                    "Exact lookup on a resolved lot, then keyword and trigram search across your policies, your comps and the questions you have already answered. Character trigrams, not embeddings, and the evals say what that costs. Nothing resolved and it abstains.",
                  ],
                  [
                    "check",
                    "Six deterministic guards against state re-read at check time. Every guard runs even after one blocks, a guard that throws fails closed, and a revise verdict aggregates to a block — there is no quiet repair-and-send. Edit a draft and the whole chain runs again.",
                  ],
                  [
                    "propose",
                    "One keystroke clears a reply and writes it to the audit chain; you put it in the room. Listing changes are proposed with a preflight, committed two-phase against an idempotency ledger, and reversible for ninety seconds afterwards.",
                  ],
                ].map(([k, b]) => (
                  <div key={k}>
                    <p className="num text-[11px] font-medium tracking-[0.08em] text-bad uppercase">
                      {k}
                    </p>
                    <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">{b}</p>
                  </div>
                ))}
              </div>
              <TempoNote>
                No console, no clock, no session to end. A subreddit's during is a standing watch
                and a queue that is always open: the thread and the branch above the question
                instead of a lot rail, no latency budget to breach because a reply to Tuesday has no
                deadline to miss, and a copy button where the live console has send.
              </TempoNote>
            </div>
            <Shot
              src="/landing/console.jpg"
              alt="The SideStage console attached to a live eBay Live watch auction: buyer chat on the left, drafted replies with guard verdicts in the middle, the pinned lot on the right"
              caption="During: the room on the left, the drafts in the middle, what they are grounded in on the right."
              className="lg:order-first"
            />
          </div>

          {/* the same question, on both sides of the glass */}
          <div className="mt-20 grid items-center gap-8 lg:grid-cols-[460px_auto_1fr]">
            <Shot
              src="/landing/ebay-live.jpg"
              alt="The eBay Live player as a buyer sees it: nickyzabbs asks 'Can you run #85 Breitling for 4k?', the comment box, and the lot card for a Rolex Daytona starting soon"
              caption="eBay Live, as the buyer sees it — nickyzabbs asks about the #85 Breitling."
            />
            <span
              className="hidden font-[Archivo,Inter,sans-serif] text-[44px] font-bold text-bad lg:block"
              aria-hidden
            >
              →
            </span>
            <Shot
              src="/landing/console-proposals.jpg"
              alt="The same question in SideStage: nickyzabbs's question quoted, a drafted reply, the lots it was grounded in, six guard pills, and a Send button"
              caption="The same question in SideStage, seconds later — admitted, grounded in the seller's own stock, six guards passed, waiting for your Enter."
            />
          </div>
        </div>
      </section>

      {/* 03 — after -------------------------------------------------------------- */}
      <section data-reveal className="bg-[#F4FBF8] py-[112px]">
        <div className={WRAP}>
          <div className="grid gap-12 lg:grid-cols-[1fr_460px] lg:items-start">
            <div>
              <PhaseHead
                n="03"
                label="after"
                title="It reports, and then it owes people answers."
                lead="Five sections and a to-do list: did it help · what the host did · can I trust it · what the agent concluded · fix before the next session. The counts are measured; the conclusion is written by the session's own agent from evidence on that same page, and it is prose from a model, so the counts come first."
              />
              <div className="mt-8">
                <Points
                  items={[
                    "Comments seen, questions, answered rate, median and p95 latency, cache hits, what each guard blocked, and whether the hash-chained audit still verifies.",
                    "Every gap — the questions nobody answered, with how often each was asked — carries a button that writes the answer straight into the catalog.",
                    "The session plays back: audio in ten-second chunks, the transcript with its emotion and intent distributions, the frames the agent read with what it read in them. All of it is deleted with the session.",
                    <>
                      And everyone who asked and did not buy leaves with a drafted answer. One per
                      buyer, re-checked against the catalog as it stands now — and skipped entirely
                      where you already settled it with a change to the listing they asked about.
                    </>,
                  ]}
                />
                <TempoNote>
                  A watch never ends, so it has no report. What a community leaves behind is the
                  record in Drafts — what you sent, what you dismissed, and a question that stops
                  being re-drafted the moment you mark it answered.
                </TempoNote>
              </div>
              <div className="mt-10 grid gap-8 sm:grid-cols-3">
                {[
                  ["77%", "answered, last session"],
                  ["23/31", "sold lots that had a question answered"],
                  ["11", "gaps, each with an Answer button"],
                ].map(([n, l]) => (
                  <div key={n}>
                    <p className="num font-[Archivo,Inter,sans-serif] text-[40px] leading-none font-bold">
                      {n}
                    </p>
                    <p className="mt-3 text-[15px] leading-snug text-text-secondary">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <Shot
                src="/landing/report.jpg"
                alt="A SideStage report for a real 74-minute jewellery show, with the host's intent and emotion distributions"
                caption="After: a report for a real 74-minute jewellery show, with the host's own intent and emotion distributions."
              />
              <div className="rounded-lg bg-panel p-7 shadow-[0_1px_0_var(--hairline)]">
                <p className="text-[20px] font-semibold">One number it will never contain</p>
                <p className="mt-4 text-[18px] font-semibold">
                  Wrong replies that reached a buyer.
                </p>
                <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
                  A reply this system judged correct is the one it cannot mark wrong. So you flag
                  them, we count what you flagged, and the report says plainly that the number is a
                  floor.
                </p>
                <p className="mt-4 text-[14px] leading-relaxed text-text-muted">
                  The report shows both figures for your own session, side by side, and says that
                  neither is the whole truth.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_520px] lg:items-center">
            <div className="rounded-lg bg-panel p-7 shadow-[0_0_0_1px_var(--hairline)]">
              <p className="text-[20px] font-semibold">The session that made the inbox exist</p>
              <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
                {/* CONTENT-32: this also said "126 of them pure hype", which
                    appears in no doc, test or fixture in either repository and
                    does not add up against the other two figures. The rest is
                    corroborated at `docs/SURFACES.md:142-145`, and the session
                    is named here so the next reader can check it. */}
                One real fragrance auction — session{" "}
                <span className="num">ebay_47tK1SX0VsiHEXN1</span>: 190 comments produced 60
                answerable drafts from 29 distinct buyers, and the seller sent none of them. That is
                not a metric, it is twenty-nine people who asked about a specific bottle and left.
                The follow-up inbox turns them into twenty-nine drafts, one per person, each re-run
                through the same guards before it is written down. A blocked one is never stored,
                and you are the one who sends them.
              </p>
            </div>
            <Shot
              src="/landing/analytics.jpg"
              alt="SideStage analytics across seven finished shows: answered rate, worst p95, comments seen, cache hit rate, block rate, flagged wrong, rolled back and audit chains intact"
              caption="Analytics across every finished session — answered rate, worst p95, block rate, audit chains verified, GMV booked from lots the copilot watched close. Live numbers from seven real eBay Live shows."
            />
          </div>
        </div>
      </section>

      {/* what makes it different -------------------------------------------- */}
      <section data-reveal className={`${WRAP} grid gap-12 py-[112px] lg:grid-cols-[440px_1fr]`}>
        <div>
          <Kicker>What makes it different</Kicker>
          <H2>It listens and looks. Most copilots only read.</H2>
          <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
            A chat bot sees the chat. On a live show this one also hears the host, sees the lot on
            camera, and knows which version of the listing every fact came from — so what it says
            can be checked, and what it will not say is a decision, not a guess.
          </p>
        </div>
        <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
          {[
            [
              "It hears you",
              "Once you share the tab's audio — it cannot start on its own — your voice arrives with emotion and intent as distributions: probability mass over the show, never a single label pretending to be a fact.",
            ],
            [
              "It sees the lot",
              "A frame off the camera, read by the same agent that answers — a price card on screen beats a listing that has not caught up. What it reads there is shown, and never counts as a citation.",
            ],
            [
              "Stale is provable",
              "Every fact carries the listing version it was read at. A markdown does not make old replies expire; it makes them unreachable.",
            ],
            [
              "One chain, every room",
              "A subreddit draft passes the guards a live reply passes, and a follow-up written a day later is re-checked against the catalog as it stands then. The console changes shape between surfaces; what may be said does not.",
            ],
          ].map(([t, b]) => (
            <div key={t}>
              <p className="text-[20px] font-semibold">{t}</p>
              <p className="mt-2 text-[16px] leading-relaxed text-text-secondary">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* guards --------------------------------------------------------------- */}
      <section id="guardrails" data-reveal className="bg-[#F4FBF8] py-[104px]">
        <div className={WRAP}>
          <Kicker>Guardrails</Kicker>
          <div className="mt-3 grid items-center gap-12 lg:grid-cols-[1fr_540px]">
            <div>
              <h2 className="font-[Archivo,Inter,sans-serif] text-[40px] leading-[1.08] font-bold tracking-[-0.02em] text-balance md:text-[48px]">
                It stops the answer that would be wrong.
              </h2>
              <p className="mt-6 text-[17px] leading-relaxed text-text-secondary">
                No model is ever asked whether a reply is safe — a checker that shares the
                generator's blind spots fails in the same direction at the same time. Six
                deterministic guards run on every draft, on every surface, against the listing as it
                stands right now. Each one points at a fact that contradicts the draft, or it
                allows.
              </p>
            </div>
            <MomentCard />
          </div>
          <div className="mt-14 grid gap-x-12 gap-y-8 md:grid-cols-3">
            {[
              ["price", "Every amount is a fact at the listing's current version."],
              ["stock", 'No "last one" unless a cited lot has one left.'],
              ["policy", "No delivery promises, off-platform payment or blanket authenticity."],
              ["grounding", "A citation that was never retrieved is worse than none."],
              ["tone", "Your voice guide: short, no markdown, no hype."],
              ["pii", "No contact details into public chat."],
            ].map(([g = "", b = ""]) => (
              <div key={g}>
                <Pill mark="" label={g} />
                <p className="mt-3 text-[16px] leading-relaxed text-text-secondary">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 grid gap-12 md:grid-cols-2">
            <div>
              <p className="text-[20px] font-semibold">What they do not do</p>
              <ul className="mt-4 flex flex-col gap-2.5 text-[16px] leading-relaxed text-text-secondary">
                <li>Judge whether a reply is good.</li>
                <li>Verify entailment — grounding checks connection, not proof.</li>
                <li>Catch what retrieval never surfaced. Abstention does that.</li>
                <li>Police what you say on air.</li>
                <li>
                  Enforce a subreddit's own rules. We read them when we attach to the room and say
                  how many are in force; the guard that would judge a draft against them is built
                  and not yet fed, so it is not a thing we sell you.
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[20px] font-semibold">Where they run</p>
              <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
                Fifteen of the seventeen never-say rules are armed on the agent itself, so they hold
                on voice and on the embed widget too. The two that stay in the app depend on whether
                a listing carries a certificate — a string matcher with no catalog access would
                block a true claim.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* autonomy ------------------------------------------------------------- */}
      <section id="autonomy" data-reveal className={`${WRAP} py-[112px]`}>
        <Kicker>Autonomy</Kicker>
        <H2>It starts as a copilot and earns every rung after that.</H2>
        <p className="mt-4 max-w-[640px] text-[16px] leading-relaxed text-text-secondary">
          Each level unlocks on evidence from your own finished shows — and an unknown never counts
          as met. What a rung changes is how much may clear without you asking. It never changes who
          carries the words into the room: that is you at L0, and it is still you at L4.
        </p>
        <div className="relative mt-12">
          <div className="absolute top-[13px] right-0 left-0 h-0.5 bg-hairline" aria-hidden />
          <div className="absolute top-[13px] left-0 h-0.5 w-[30%] bg-bad" aria-hidden />
          <div className="relative grid gap-6 md:grid-cols-5">
            {[
              ["L0", "Observe", "Classifies chat. Suggests nothing.", false],
              ["L1", "Suggest · you are here", "Drafts everything. You send it.", true],
              [
                "L2",
                "One-tap",
                "Pre-approved for a single keystroke, after three clean shows.",
                false,
              ],
              [
                "L3",
                "Auto-clear",
                "Allow-listed topics clear themselves once every guard passes, ready for you to post. Never price, never discount.",
                false,
              ],
              [
                "L4",
                "Auto-act · locked",
                "Stock fixes and markdowns with undo. Locked until a show writes to eBay and the rollback rate holds across five shows — not because a number says so.",
                false,
              ],
            ].map(([n, t, b, here]) => (
              <div key={n as string}>
                <span
                  className={`num inline-grid size-7 place-items-center rounded-full text-[12px] font-semibold ${here ? "bg-bad text-white" : "bg-panel text-text-secondary shadow-[0_0_0_1px_var(--hairline-strong)]"}`}
                >
                  {n as string}
                </span>
                <p className="mt-4 text-[18px] font-semibold">{t as string}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
                  {b as string}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* price ----------------------------------------------------------------- */}
      <section id="price" data-reveal className="bg-[#F4FBF8] py-[96px]">
        <div className={`${WRAP} grid gap-10 lg:grid-cols-[1fr_320px] lg:items-end`}>
          <div>
            <Kicker>What it costs</Kicker>
            <H2>One agent, metered by the minute. We show you the meter.</H2>
            <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-text-secondary">
              The one agent behind every reply cost $0.06 a minute on the session we measured — nine
              minutes of a watch auction — which would be about $7 across two hours if it held. It
              is an observation and not a rate: nothing in the product quotes one, and the cost page
              names no price either. The count of calls is exact; the dollars come from what the
              wallet actually moved, never from a token-price guess, and the app reports them per
              hour and per answered question with the basis named. Set a per-session cap and it
              stops rather than draining a wallet quietly.
            </p>
          </div>
          <div className="flex gap-10">
            {[
              ["$0.06", "a minute, on the one session we measured"],
              ["≈ $7", "two hours, if that holds"],
            ].map(([n, l]) => (
              <div key={n}>
                <p className="num font-[Archivo,Inter,sans-serif] text-[40px] leading-none font-bold">
                  {n}
                </p>
                <p className="mt-3 text-[15px] text-text-secondary">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta ------------------------------------------------------------------- */}
      <section className={`${DARK} py-[104px]`}>
        <div className={`${WRAP} grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end`}>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold tracking-[0.04em] text-[#FF7A6B]">
              <span className="anim-live size-2 rounded-full bg-[#FF7A6B]" aria-hidden /> ON AIR ·
              AND IN THE THREAD
            </span>
            <h2 className="mt-5 font-[Archivo,Inter,sans-serif] text-[44px] leading-[1.05] font-bold tracking-[-0.02em] text-balance">
              Point it at tonight's show, or at the thread from last Tuesday.
            </h2>
            <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-white/70">
              One account, one box that takes a show, a channel or a subreddit. A session you do not
              own is monitored read-only — it drafts, proposes and reports, and never writes to a
              listing. Everything it writes is still yours to send.
            </p>
          </div>
          <div className="flex flex-wrap gap-3.5">
            <Primary to="/register">Create an account</Primary>
            <Secondary to="/privacy" light>
              Read the privacy policy
            </Secondary>
          </div>
        </div>
      </section>

      {/* footer ---------------------------------------------------------------- */}
      <footer className={`${WRAP} py-14`}>
        <div className="grid gap-10 md:grid-cols-3">
          {[
            [
              "Known limits",
              [
                "p95 misses the 2s budget on the cold path.",
                "No surface delivers a reply. We draft, check, record and audit it; you paste it. eBay Live publishes no chat-post API, the scraped surfaces have no send path by construction, Reddit refuses the action in four separate places, and Twitch's is written and tested but not wired into the executor.",
                "Listing writes run against a mock by default; the eBay adapter is switched on per show, after you consent on eBay's own page. No live action has committed through it yet.",
                "Comparables are asking prices, not sold prices — eBay's completed-sales feed is limited-release and this keyset was not granted it.",
                "TikTok Live, Twitch and Reddit need a flag or their own credentials; the app names the variable instead of failing vaguely. YouTube Live is a capability row with no adapter, so it is not offered.",
                "Privacy and terms are pages of the product — /privacy, /terms — written from what it actually stores.",
                "Discover's eBay Live source needs your signed-in session and runs on your own machine — that grid is refused from a server. The surfaces with public APIs need their own credentials instead, and attaching by link runs anywhere.",
              ],
            ],
            [
              "How it runs",
              [
                "One agent per session, created before the show if you prepare it, deleted with the session.",
                "Guardrails armed on the agent, not only in the app.",
                "Hash-chained audit for every approved reply and every write.",
                "Posting into a room you do not own starts off, stays off until you turn it on for that room — and cannot be turned on at all where the surface is draft-only. Nothing in this build acts on that switch yet; it is the lock, ahead of the door.",
              ],
            ],
            [
              "Built for",
              [
                "The AI Fund × eBay SideStage challenge.",
                "PRD, TDD and evals in the repository.",
                "Every doc-to-code divergence noted in line.",
              ],
            ],
          ].map(([h, items]) => (
            <div key={h as string}>
              <p className="text-[16px] font-semibold">{h as string}</p>
              <ul className="mt-3 flex flex-col gap-2 text-[14px] leading-relaxed text-text-secondary">
                {(items as string[]).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 text-[13px] text-text-muted">
          <LogoLockup size={20} />
          <span>
            © 2026 Whissle · A Whissle Voice Agents product ·{" "}
            <Link to="/privacy" className="hover:text-text">
              Privacy
            </Link>{" "}
            ·{" "}
            <Link to="/terms" className="hover:text-text">
              Terms
            </Link>{" "}
            ·{" "}
            <a href="https://github.com/WhissleAI/sidestage-copilot" className="hover:text-text">
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
