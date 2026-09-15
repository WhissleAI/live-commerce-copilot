/**
 * The front door — what a visitor sees before they have an account.
 *
 * Built from the Figma landing (SideStage — Brand, Landing & Design Template ·
 * 02 · Landing page), section for section, with the same claims: measured
 * numbers with their caveats attached, the limits stated before anyone asks,
 * and the one moment the product exists for — a wrong answer, blocked — above
 * the fold. Nothing on this page says something the app does not do.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { LogoLockup } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

/** The sections the nav points at, in page order. */
const NAV = [
  ["how", "How it works"],
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
  document.getElementById(id)?.scrollIntoView({ behavior: motion(), block: "start" });
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

/** A real screenshot, framed. Every image on this page is a capture of the
 *  product or of eBay Live, never a mock — the caption says which. */
function Shot({
  src,
  alt,
  caption,
  className = "",
}: {
  src: string;
  alt: string;
  caption?: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={className}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
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

/** Four seconds of a real show, replayed: the lot moved, the draft quoted the
 *  old price, the price guard blocked it. */
function MomentCard() {
  return (
    <div>
      <div className="overflow-hidden rounded-lg bg-canvas shadow-[0_1px_0_var(--hairline),0_12px_40px_-24px_rgba(0,0,0,.35)]">
        <div className="flex h-[42px] items-center gap-3 px-4 text-[12px] shadow-[0_1px_0_var(--hairline)]">
          <span className="flex items-center gap-1.5 font-semibold text-bad">
            <span className="anim-live size-[7px] rounded-full bg-bad" aria-hidden /> LIVE
          </span>
          <span className="num text-text-secondary">01:12:36</span>
          <span className="ml-auto text-text-muted">s_okafor asked about the trucker</span>
        </div>
        <div className="bg-panel p-5">
          <p className="num text-[14px] font-medium">
            the lot moved four seconds ago — it is now v13
          </p>
          <p className="mt-3 text-[16px] text-text-muted line-through">
            I can do $132.00 on the trucker jacket if you want it
          </p>
          <div className="mt-4 flex gap-3 rounded-md bg-bad/[0.07] px-3.5 py-3">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <div>
              <p className="text-[14px] font-semibold text-bad">Blocked by the price guard</p>
              <p className="num mt-0.5 text-[13px] text-text-secondary">
                expected $148.00 · found $132.00
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
        Four seconds of a real show, replayed: the lot moved, the draft quoted the old price, the
        guard blocked it. Run it yourself: <span className="num">npm run demo:stale-price</span>
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
            <span className="anim-live size-2 rounded-full bg-bad" aria-hidden /> ON AIR
          </span>
          <h1 className="mt-6 font-[Archivo,Inter,sans-serif] text-[42px] leading-[1.04] font-bold tracking-[-0.025em] text-balance md:text-[52px]">
            It watches the show. It answers the room. You keep the last word.
          </h1>
          <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-text-secondary">
            SideStage attaches to an eBay Live show and works the room while you sell. It reads the
            chat, hears you, sees the lot on camera, drafts every reply, proposes every markdown and
            stock fix, and writes the report afterwards — and nothing reaches a buyer or a listing
            until you press Enter.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5">
            <Primary to="/register">
              Create an account <span className="text-[13px] opacity-80">free</span>
            </Primary>
            <Secondary to="/login">Sign in</Secondary>
          </div>
          <p className="mt-6 max-w-[528px] text-[13px] leading-relaxed text-text-muted">
            For eBay Live sellers running solo · read-only on any show, writes only on yours · a
            human approves every send and every action, at every rung
          </p>
        </div>

        <Shot
          src="/landing/console.jpg"
          alt="The SideStage console attached to a live eBay Live watch auction: buyer chat on the left, drafted replies with guard verdicts in the middle, the pinned lot on the right"
          caption="The console on a real eBay Live show tonight — 558 watching, 19 replies drafted, 0 sent without you. A screenshot, not a mock."
        />
      </section>

      {/* proof band ----------------------------------------------------------- */}
      <section className={`${DARK} py-20`}>
        <div className={`${WRAP} grid gap-14 md:grid-cols-3`}>
          {[
            [
              "2.11s",
              "against a 2.00s budget. We missed it.",
              "Every breach is counted and shown on the show bar rather than averaged away. You will see the number we are not proud of before you see the ones we are.",
              "text-[#F5B84A]",
            ],
            [
              "$0.06",
              "a minute on air. About $7 for a two-hour show.",
              "One omni-channel agent per show — it reads the chat, hears the host, sees the lot — metered by the minute, with the meter beside the queue while the show runs. Measured tonight: $0.52 for nine minutes of a watch auction. An upper bound, because the wallet is org-wide, and it says so there too.",
              "",
            ],
            [
              "1.000",
              "precision and recall — on our own 44 cases.",
              "Which proves internal consistency and not much else, since the same person wrote the guards and the tests. Live traffic has caught seven bugs the suite never would have.",
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

      {/* who it is for --------------------------------------------------------- */}
      <section data-reveal className={`${WRAP} grid gap-12 py-[112px] lg:grid-cols-[440px_1fr]`}>
        <div>
          <Kicker>Who it is for</Kicker>
          <H2>One person, three jobs, on camera.</H2>
          <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
            A brand's live show has a producer, a moderator and a merchandiser. You are all three,
            while holding the item up to a lens.
          </p>
        </div>
        <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
          {[
            ["Questions scroll past", "Every one was a buyer who was close."],
            ["Edits land late", "The markdown, the sold-out lot, the wrong pin."],
            ["Fast answers go wrong", "A stale price is a refund tomorrow."],
            ["Then it all disappears", "Including what your listings should have said."],
          ].map(([t, b]) => (
            <div key={t}>
              <p className="text-[20px] font-semibold">{t}</p>
              <p className="mt-2 text-[16px] leading-relaxed text-text-secondary">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* before · during · after ------------------------------------------------ */}
      <section id="moments" data-reveal className="bg-canvas py-[112px]">
        <div className={WRAP}>
          <Kicker>Before · During · After</Kicker>
          <H2>
            Three moments, one copilot. It is ready before the show, present during it, and honest
            afterwards.
          </H2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {[
              [
                "01 — before",
                "It prepares",
                "/landing/shows.jpg",
                "Home: readiness for your own show, and a live show to attach to",
                [
                  "Sees what is live on eBay and prepares a show ahead: its own agent, its own catalog from the seller's listings",
                  "Prices every lot against sold comps, not asking prices",
                  "Readiness says what it can and cannot ground — and carries last show's gaps in",
                ],
              ],
              [
                "02 — during",
                "It perceives, then answers",
                "/landing/console.jpg",
                "The console mid-show: chat, proposals, the pinned lot",
                [
                  "Buyer chat, your voice with emotion and intent, a frame off the camera",
                  "Grounded replies, six deterministic guards, one keystroke to send",
                  "Markdowns and stock fixes proposed with a preflight, committed with undo, hash-chained",
                ],
              ],
              [
                "03 — after",
                "It reports, in your words and its own",
                "/landing/report.jpg",
                "A report for a real 74-minute jewellery show, with the host's intent and emotion distributions",
                [
                  "Did it help · what the host did · can I trust it · what the agent concluded · fix before the next show",
                  "The show played back: audio, transcript with its distributions, the frames it read",
                  "Every gap answered into the catalog, and the next rung earned on your own numbers",
                ],
              ],
            ].map(([k, t, src, alt, items]) => (
              <div key={k as string}>
                <p className="num text-[12px] font-medium text-bad">{k as string}</p>
                <p className="mt-3 text-[20px] font-semibold">{t as string}</p>
                <Shot src={src as string} alt={alt as string} className="mt-4" />
                <ul className="mt-4 flex flex-col gap-2.5 text-[16px] leading-relaxed text-text-secondary">
                  {(items as string[]).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* where it plugs in ---------------------------------------------------- */}
      <section id="plugs" data-reveal className="bg-[#F4FBF8] py-[112px]">
        <div className={WRAP}>
          <Kicker>Where it plugs in</Kicker>
          <H2>It reads the same page your buyers see.</H2>
          <p className="mt-5 max-w-[640px] text-[17px] leading-relaxed text-text-secondary">
            No private API and no special access. SideStage opens the public eBay Live player, reads
            the chat and the lot card as they render, hears the host through a tab-audio bridge, and
            samples a frame off the camera every twelve seconds. What eBay shows the room, the
            copilot sees — every lot versioned as the auction moves, so a reply can be checked
            against the state it was written for.
          </p>
          <div className="mt-12 grid items-center gap-8 lg:grid-cols-[460px_auto_1fr]">
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

      {/* what makes it different -------------------------------------------- */}
      <section data-reveal className={`${WRAP} grid gap-12 py-[112px] lg:grid-cols-[440px_1fr]`}>
        <div>
          <Kicker>What makes it different</Kicker>
          <H2>It listens and looks. Most copilots only read.</H2>
          <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
            A chat bot sees the chat. This one hears the host, sees the lot on camera, and knows
            which version of the listing every fact came from — so what it says can be checked, and
            what it will not say is a decision, not a guess.
          </p>
        </div>
        <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
          {[
            [
              "It hears you",
              "Your voice, with emotion and intent as distributions — probability mass over the show, never a single label pretending to be a fact.",
            ],
            [
              "It sees the lot",
              "A frame off the camera, read by the same agent that answers — a price card on screen beats a listing that has not caught up.",
            ],
            [
              "Stale is provable",
              "Every fact carries the listing version it was read at. A markdown does not make old replies expire; it makes them unreachable.",
            ],
            [
              "Autonomy is earned",
              "Five rungs, each promoted on evidence from your own finished shows. An unknown never counts as met.",
            ],
          ].map(([t, b]) => (
            <div key={t}>
              <p className="text-[20px] font-semibold">{t}</p>
              <p className="mt-2 text-[16px] leading-relaxed text-text-secondary">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works --------------------------------------------------------- */}
      <section id="how" data-reveal className="bg-canvas py-[112px]">
        <div className={WRAP}>
          <Kicker>How it works</Kicker>
          <H2>Four steps between a buyer typing and you pressing Enter.</H2>
          <div className="mt-14 grid gap-10 md:grid-cols-4">
            {[
              [
                "01 — perceive",
                "It watches the show",
                [
                  "Buyer chat",
                  "Your voice, with emotion and intent",
                  "A frame off the camera",
                  "The lot card, re-read every 2s",
                ],
              ],
              [
                "02 — ground",
                "It answers from facts",
                [
                  "Exact lookup on a resolved lot",
                  "Hybrid search over policies and comps",
                  "Nothing resolved? It abstains",
                ],
              ],
              [
                "03 — check",
                "Six guards, every reply",
                [
                  "Against state re-read at check time",
                  "One repair pass, then it blocks",
                  "A blocked card has no Send button",
                ],
              ],
              [
                "04 — propose",
                "You stay the decision",
                [
                  "Send with one keystroke",
                  "Markdowns proposed, never taken",
                  "Undo window on everything committed",
                ],
              ],
            ].map(([k, t, items]) => (
              <div key={k as string}>
                <p className="num text-[12px] font-medium text-bad">{k as string}</p>
                <p className="mt-3 text-[20px] font-semibold">{t as string}</p>
                <ul className="mt-4 flex flex-col gap-2 text-[16px] leading-relaxed text-text-secondary">
                  {(items as string[]).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
                deterministic guards run on every draft against the listing as it stands right now.
                Each one points at a fact that contradicts the draft, or it allows.
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
          as met.
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
              ["L3", "Auto-reply", "Allow-listed topics only. Never price, never discount.", false],
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

      {/* after the show ------------------------------------------------------- */}
      <section data-reveal className="bg-canvas py-[112px]">
        <div className={`${WRAP} grid gap-12 lg:grid-cols-[1fr_460px]`}>
          <div>
            <Kicker>After the show</Kicker>
            <H2>Five sections, and a to-do list at the end.</H2>
            <p className="mt-4 max-w-[600px] text-[16px] leading-relaxed text-text-secondary">
              Did it help · What the host did · Can I trust it · What the agent concluded · Fix
              before the next show. The host section is measured from your own speech; the
              conclusion is written by the show's agent from evidence on the same page; the gaps are
              answered straight into the catalog. And the whole show plays back — audio, transcript
              with its distributions, the frames the agent read.
            </p>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {[
                ["77%", "answered, last show"],
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
          <div className="rounded-lg bg-panel p-7 shadow-[0_1px_0_var(--hairline)]">
            <p className="text-[20px] font-semibold">One number it will never contain</p>
            <p className="mt-4 text-[18px] font-semibold">Wrong replies that reached a buyer.</p>
            <p className="mt-4 text-[16px] leading-relaxed text-text-secondary">
              A reply this system judged correct is the one it cannot mark wrong. So you flag them,
              we count what you flagged, and the report says plainly that the number is a floor.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-text-muted">
              Three flagged on the last show. Two more caught by a later state change. Neither is
              the whole truth.
            </p>
          </div>
        </div>
        <div className={`${WRAP} mt-14`}>
          <Shot
            src="/landing/analytics.jpg"
            alt="SideStage analytics across seven finished shows: answered rate, worst p95, comments seen, cache hit rate, block rate, flagged wrong, rolled back and audit chains intact"
            caption="Analytics across every finished show — answered rate, worst p95, block rate, audit chains verified, GMV booked from lots the copilot watched close. Live numbers from seven real eBay Live shows."
          />
        </div>
      </section>

      {/* price ----------------------------------------------------------------- */}
      <section id="price" data-reveal className="bg-[#F4FBF8] py-[96px]">
        <div className={`${WRAP} grid gap-10 lg:grid-cols-[1fr_320px] lg:items-end`}>
          <div>
            <Kicker>What it costs</Kicker>
            <H2>One agent, metered by the minute. We show you the meter.</H2>
            <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-text-secondary">
              $0.06 a minute on air — about $3.60 an hour, about $7 for a two-hour show — for the
              omni-channel agent behind every reply. Set a per-show cap and it stops rather than
              draining a wallet quietly.
            </p>
          </div>
          <div className="flex gap-10">
            {[
              ["$0.06", "per minute on air"],
              ["≈ $7", "a two-hour show"],
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
              <span className="anim-live size-2 rounded-full bg-[#FF7A6B]" aria-hidden /> ON AIR
            </span>
            <h2 className="mt-5 font-[Archivo,Inter,sans-serif] text-[44px] leading-[1.05] font-bold tracking-[-0.02em] text-balance">
              Point it at tonight's show.
            </h2>
            <p className="mt-5 max-w-[560px] text-[17px] leading-relaxed text-white/70">
              One account, one URL. A show you do not own is monitored read-only — it drafts,
              proposes and reports, and never writes to a listing.
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
                "Listing writes run against a mock by default; the eBay adapter is switched on per show, after you consent on eBay's own page.",
                "Privacy and terms are pages of the product — /privacy, /terms — written from what it actually stores.",
                "Discover needs your signed-in eBay Live session and runs on your own machine — the live grid is refused from a server. Attaching by link runs anywhere.",
              ],
            ],
            [
              "How it runs",
              [
                "One omni-channel agent per stream, created before the show if you prepare it, deleted with the session.",
                "Guardrails armed on the agent, not only in the app.",
                "Hash-chained audit for every send and every write.",
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
