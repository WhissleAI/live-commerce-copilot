/**
 * Privacy and terms — plain pages, because eBay's redirect registration needs
 * an https privacy policy and the consent screen links to it.
 *
 * Written from what the product actually stores, not from a template. Two
 * things were wrong with the version this replaces, and both were the same
 * mistake: the page was written in eBay's nouns, in an earlier month.
 *
 *  1. It carried a SANDBOX NOTICE — "listings, prices and accounts there are
 *     test data; nothing it does reaches ebay.com buyers or sellers". The
 *     deployed backend has `EBAY_ENV=production` (`.env:13`), which
 *     `src/config.ts:56` resolves to production, and the reading paths never
 *     had a sandbox at all: the eBay Live watcher and the discovery and
 *     seller-listing scrapes fetch `https://www.ebay.com/...` regardless of
 *     that variable (`src/ingest/ebaylive/watcher.ts:220`,
 *     `discovery.ts:172,218`, `sellerListings.ts:80,114`). Real people's
 *     handles and questions were being stored under a policy telling them
 *     they were test data.
 *  2. It described a single-surface eBay product. Five more surfaces read
 *     other people's words — Reddit, Twitch, Whatnot, TikTok Live and the
 *     follow-up inbox — and none of them was disclosed.
 *
 * So the structure changed with the content. "What it stores" is organised by
 * WHAT THE THING IS rather than by where it came from, because that is the
 * shape that survives the next surface: a seventh place to read a comment adds
 * a row to "what it reads" and changes nothing else. Every claim below was
 * read out of the backend, and the file:line is in the comment above it.
 *
 * What is deliberately NOT here, and is a decision for a person rather than a
 * gap to be filled in with a plausible sentence:
 *   · a retention period. The code has no time-based deletion of anything a
 *     person said (see RETENTION below), so any number here would be a policy
 *     invented by its author.
 *   · a legal basis, a controller/processor split, or a data-subject-request
 *     process. None of the three exists in code and none should be guessed at
 *     on a page that people are pointed to from an OAuth consent screen.
 */

import { Link } from "@tanstack/react-router";
import { LogoLockup } from "@/components/brand/Logo";

const UPDATED = "19 September 2026";
const CONTACT = "ksingla@whissle.ai";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto w-full max-w-[720px] px-6 py-10">
        <Link
          to="/"
          className="flex items-center gap-2 text-[12.5px] text-text-muted hover:text-text"
        >
          <LogoLockup size={20} />
        </Link>
        <h1 className="mt-6 text-[26px] font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="mt-1 text-[12.5px] text-text-muted">Last updated {UPDATED}</p>
        <div className="mt-8 flex flex-col gap-6 text-[14px] leading-relaxed text-text-secondary [&_h2]:mt-2 [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-text [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
          {children}
        </div>
        <p className="mt-10 text-[12.5px] text-text-muted">
          <Link to="/privacy" className="hover:text-text">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/terms" className="hover:text-text">
            Terms
          </Link>{" "}
          · Questions: {CONTACT}
        </p>
      </div>
    </div>
  );
}

/**
 * What each surface reads, and how.
 *
 * Exported because a page that lists six surfaces and a capability table that
 * has seven is the bug this whole rewrite exists to stop happening again — the
 * spec beside this file holds the two together.
 *
 * `simulated` is absent on purpose: it is a hard-coded script with invented
 * names (`src/ingest/script.ts`) and reads nothing from anywhere.
 */
export const SURFACE_READS: { id: string; surface: string; how: string }[] = [
  {
    id: "ebaylive",
    surface: "eBay Live",
    // src/ingest/ebaylive/watcher.ts:220 opens the player page in a real
    // Chrome; :357-362 reads each chat row's id, author element and text.
    how: "A browser we run opens the show's public page on www.ebay.com and reads the chat as it appears on screen — each comment's display handle and its text. It is signed in to an eBay account we hold, in the way any viewer would be.",
  },
  {
    id: "whatnot",
    surface: "Whatnot",
    // src/surfaces/whatnot/scrape.ts:86-90, :44-52
    how: "The same browser, on the show's public page at whatnot.com. Username and message text.",
  },
  {
    id: "tiktoklive",
    surface: "TikTok Live",
    // src/surfaces/tiktoklive/scrape.ts:80-82, :42-44; the adapter refuses to
    // open unless TIKTOK_LIVE_ENABLED is set, and it is not set in production.
    how: "The same browser, on a public tiktok.com/@handle/live page. Nickname and comment text. This surface is behind its own switch and is off in the version we run.",
  },
  {
    id: "twitch",
    surface: "Twitch",
    // src/surfaces/twitch/chat.ts:170-180 reads display-name, user-id, text
    // and tmi-sent-ts; src/shows/runtime.ts:546 keeps only author/text/id.
    how: "Twitch's own APIs, on a channel you connect with your own sign-in. Chat carries a display name, a Twitch user id and a timestamp; we keep the name and the message and drop the id and the timestamp.",
  },
  {
    id: "reddit",
    surface: "Reddit",
    // src/surfaces/reddit/poll.ts:65, thread.ts:88-112, :210
    how: "Reddit's own API, on the subreddits you choose: new posts and the branch of the comment tree above the comment being answered. We keep the author name and the text; the permalink and Reddit's own timestamp are read and not stored.",
  },
  {
    id: "dm",
    surface: "Follow-ups",
    // src/surfaces/dm/adapter.ts:72-80 — open() always throws. Built from the
    // session record already in the database by selectFollowUps().
    how: "Nothing new. It reads nothing from any platform — it is built from the questions already stored from a finished session, one per person who asked and did not buy.",
  },
];

export function PrivacyPage() {
  return (
    <Frame title="Privacy policy">
      <p>
        SideStage is a copilot for one person answering a room. It reads a public conversation —
        a live show&apos;s chat, a stream&apos;s chat, a subreddit thread — drafts replies for the
        operator to send, and, on the operator&apos;s own eBay listings and at their instruction,
        acts. This page says what it reads, what it keeps, where that goes, and for how long. It
        is written from the code, and the parts nobody has decided yet are marked as such rather
        than filled in.
      </p>

      {/* Replaces the sandbox notice. The old one said the opposite of this. */}
      <h2>This runs against the real thing</h2>
      <p>
        SideStage is a working prototype, but it is not a sandbox. It reads live eBay.com shows and
        live public pages on the other platforms, and the eBay account you connect is a real one:
        listing changes made through SideStage change real listings. The people whose comments it
        reads are real people who have not heard of us. That is the reason this page exists in the
        shape it is in.
      </p>

      <h2>What it reads, and where</h2>
      <p>
        Only what is public, and only in the rooms an operator points it at. It signs in as nobody
        but the operator, and it reads a room the way a viewer of that room reads it.
      </p>
      <ul>
        {SURFACE_READS.map((s) => (
          <li key={s.id}>
            <strong>{s.surface}.</strong> {s.how}
          </li>
        ))}
      </ul>

      <h2>What it stores</h2>
      <p>
        Grouped by what the thing is, because every surface above produces the same few kinds of
        record.
      </p>
      <ul>
        <li>
          {/* chat_messages (004_session_record.sql:18-29) and reply_proposals
              (:37-57); the audit table's summary and detail carry the handle
              and up to 80 characters of the message (pipeline.ts:477,486,548). */}
          <strong>Comments by people who are not you.</strong> For every comment SideStage reads in
          a monitored room it keeps the author&apos;s display name as that platform showed it, the
          text of the comment, and the time we received it. For every comment it answered it also
          keeps the reply it drafted, the guardrail verdicts on that reply, and what the operator
          did with it — sent, edited, or dismissed. The name and the first part of the comment are
          also written into a tamper-evident audit log, which is the record of who approved what.
        </li>
        <li>
          {/* followups (021_followups.sql:21-34): buyer, question, draft. */}
          <strong>Follow-ups.</strong> When a session ends, SideStage writes one record per person
          who asked something and did not buy: their handle, their question in their own words, and
          a reply for the operator to send. Nothing is sent by us — see the terms.
        </li>
        <li>
          {/* persona_voice (020_personas.sql:57-70) — account-scoped, show_id
              is a bare TEXT column with no foreign key. */}
          <strong>The operator&apos;s own voice.</strong> Replies the operator sent are kept as
          style references, so later drafts sound like them. A style reference stores the reply
          <em> and the question it answered</em>, which means it carries a sentence somebody else
          wrote. These are attached to the operator&apos;s account rather than to a session, and
          deleting a session does not delete them.
        </li>
        <li>
          {/* getDisplayMedia in src/api/audioBridge.ts:158 — a browser gesture,
              and audioBridge.ts:19-21 says the server cannot start it. Chunks
              at :94-96; frames at :102,:360-370; only read frames are kept
              (routes.ts:2910-2918). */}
          <strong>The host&apos;s voice and picture, if the operator starts the audio bridge.</strong>{" "}
          This cannot be started from our server: the operator opens a page in their own browser and
          shares the tab themselves. While it runs, the host&apos;s speech is transcribed and its
          emotion and intent estimated; the audio is kept in ten-second chunks on our server&apos;s
          disk. A frame of the shared tab is taken every twelve seconds, and a frame is kept only if
          the model actually read something from it. Frames it skipped are not kept.
        </li>
        <li>
          {/* listings/comps/policies/qa, 001_init.sql; actions + action_commits. */}
          <strong>The operator&apos;s listings, policies and answers.</strong> Their own catalog,
          imported or uploaded, the lot data read from the show, and every action taken on a listing
          — a markdown, a stock change, a listing ended — in the same hash-chained audit log.
        </li>
        <li>
          {/* ebay_accounts (010_ebay_accounts.sql:23-36), twitch_accounts
              (022_twitch_accounts.sql:16-27). */}
          <strong>Tokens for the accounts the operator connects.</strong> eBay and Twitch issue
          these after the operator consents on those platforms&apos; own sign-in pages. SideStage
          never sees a password. They are used only for the scopes that were approved and are
          deleted when the operator disconnects.
        </li>
        <li>
          <strong>Account and settings.</strong> A display name for the operator, their guardrail
          policy, automation preferences and spend limits.
        </li>
      </ul>

      <h2>Where it goes</h2>
      <ul>
        <li>
          {/* src/llm/whissle.ts:1 — "the ONLY LLM provider in this system";
              buildUserMessage (src/compose/prompts.ts:328-330) sends the
              author's display name with the question. */}
          <strong>Whissle</strong> runs the language and speech models. It is the only such provider
          SideStage uses — there is no call to any other model vendor anywhere in the code. To draft
          a reply we send the asker&apos;s display name and their question; where a thread is being
          answered we send the comments above it, which are other people&apos;s words and names. The
          operator&apos;s catalog and policies are uploaded to a per-session knowledge base, host
          audio is streamed to a listen-only session for transcription, and kept frames are sent for
          a reading. Whissle&apos;s own policy applies to that processing.
        </li>
        <li>
          <strong>eBay, Twitch and Reddit</strong> receive the API calls made on the operator&apos;s
          behalf, and serve the public pages and feeds SideStage reads. Whatnot and TikTok receive
          ordinary page requests from the browser SideStage runs.
        </li>
        <li>
          {/* EBAY_DISCOVERY_PROXY, src/ingest/ebaylive/session.ts:218-230 —
              and scrapeWatcher.ts:157-163 opens through the same helper. */}
          <strong>A network proxy,</strong> when one is configured, carries the page requests for
          eBay Live discovery and for the Whatnot and TikTok watchers. It sees the requests for
          those public pages.
        </li>
        <li>Nothing is sold, and nothing is used to train models.</li>
      </ul>

      {/* RETENTION. The honest version. See the file comment. */}
      <h2>How long</h2>
      <p>
        There is no timer. SideStage does not delete anything a person said after any period,
        because no such rule has been written — not in the code and not as a policy. What exists is
        deletion by hand, and it is complete: deleting a session deletes its chat, its proposals,
        its audit log, its transcript, its audio and its frames, its follow-ups and its report,
        along with the per-session agent and its knowledge base. Disconnecting an account deletes
        that account&apos;s tokens. A session can be exported as JSON at any time from its report.
      </p>
      <p>
        Two things outlive the session they came from, and this page would rather say so than be
        accurate only in general: the style references described above, which are attached to the
        operator&apos;s account and carry the question each reply answered; and the record eBay
        sends us when one of its members closes their account, which we keep in order to be able to
        show that we acted on it.
      </p>
      <p>
        <strong>Not decided yet.</strong> A retention period, the legal basis for reading public
        comments in each of the places this runs, and a process for someone who is not our operator
        to ask what we hold about them and have it removed. These are the questions this product
        will have to answer, and we would rather leave them named than answer them with a sentence
        nobody has stood behind. Until then: write to {CONTACT} and a person will answer.
      </p>

      <h2>Contact</h2>
      <p>Whissle AI · {CONTACT}</p>
    </Frame>
  );
}

export function TermsPage() {
  return (
    <Frame title="Terms of use">
      <p>
        SideStage is provided by Whissle AI as a working prototype for people who answer a room —
        a live-commerce show, a stream&apos;s chat, a subreddit, and the follow-ups left over
        afterwards. By using it you agree to the following.
      </p>

      <h2>What it does, and does not</h2>
      <ul>
        <li>
          It drafts replies and proposes listing actions.{" "}
          <strong>You send, and you approve.</strong> A reply that reaches anybody, and an action
          that changes a listing, is your decision — the guardrails reduce mistakes, they do not
          remove your responsibility for what goes out under your name.
        </li>
        <li>
          {/* actions/proposer.ts never produces post_reply; actions/executor.ts
              has no branch for it; surfaces/twitch/actions.ts is imported by
              its own test and by nothing in src/. */}
          <strong>Nothing in this build posts for you.</strong> On every surface, an approved reply
          is re-checked, recorded and written into the audit chain, and then handed back to you to
          put in the room yourself. There is no path in the running app that posts a comment
          anywhere. Rooms you do not own carry a posting switch that is off by default and refuses
          to exist at all where the platform is draft-only; nothing acts on it yet.
        </li>
        <li>
          Rooms you do not own are read-only. SideStage drafts and proposes there, and never writes
          to a listing that is not yours.
        </li>
        <li>
          {/* EBAY_ENV=production; the scrapes are production-only regardless. */}
          This is not a test environment. It reads live eBay.com shows and live public pages
          elsewhere, and the eBay account you connect is a real one — a listing change made through
          SideStage changes a real listing.
        </li>
        <li>
          Emotion and intent estimates on host speech are probabilities from a model, shown as such.
          They are not a judgment about a person.
        </li>
      </ul>

      <h2>The rooms you point it at</h2>
      <p>
        You choose which shows, channels and subreddits SideStage watches, and you are responsible
        for that choice. Every platform above has its own rules about automated reading and about
        replies written with a model&apos;s help — Reddit&apos;s in particular — and following them
        in the rooms you operate in is your part, not ours. SideStage reads only what is public, and
        holding it to that is a commitment we make in code: see the privacy policy for what each
        surface reads.
      </p>

      <h2>Your accounts</h2>
      <p>
        You connect eBay and Twitch through those platforms&apos; own consent screens and can revoke
        access there or by disconnecting in Settings. You are responsible for the listings and
        content in your accounts and for complying with each platform&apos;s user agreement.
      </p>

      <h2>Availability and warranty</h2>
      <p>
        The service is offered as-is, without warranty, and may change or stop at any time. It is a
        prototype: features arrive and are withdrawn, and the app tells you which ones are not
        wired up rather than hiding them.
      </p>

      <h2>Contact</h2>
      <p>Whissle AI · {CONTACT}</p>
    </Frame>
  );
}
