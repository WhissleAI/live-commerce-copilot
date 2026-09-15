/**
 * Privacy and terms — plain pages, because eBay's redirect registration needs
 * an https privacy policy and the consent screen links to it.
 *
 * Written from what the product actually stores (Settings → Account & data is
 * the same list), not from a template. If the retention list changes there, it
 * changes here.
 */

import { Link } from "@tanstack/react-router";
import { LogoLockup } from "@/components/brand/Logo";

const UPDATED = "14 September 2026";
const CONTACT = "ksingla@whissle.ai";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto w-full max-w-[720px] px-6 py-10">
        <Link to="/shows" className="flex items-center gap-2 text-[12.5px] text-text-muted hover:text-text">
          <LogoLockup size={20} />
        </Link>
        <h1 className="mt-6 text-[26px] font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="mt-1 text-[12.5px] text-text-muted">Last updated {UPDATED}</p>
        <div className="mt-8 flex flex-col gap-6 text-[14px] leading-relaxed text-text-secondary [&_h2]:mt-2 [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:text-text [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
          {children}
        </div>
        <p className="mt-10 text-[12.5px] text-text-muted">
          <Link to="/privacy" className="hover:text-text">Privacy</Link> ·{" "}
          <Link to="/terms" className="hover:text-text">Terms</Link> · Questions: {CONTACT}
        </p>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <Frame title="Privacy policy">
      <p>
        SideStage is a copilot for people who sell on live-commerce shows. It reads a show's public
        chat, drafts replies for the seller to send, and — when the seller chooses — acts on the
        seller's own listings. This page says what it keeps, where, and for how long.
      </p>

      <h2>What SideStage stores</h2>
      <ul>
        <li>
          <strong>Show chat and the copilot's proposals.</strong> Public comments on a monitored show,
          the replies the copilot drafted, the guardrail verdicts on each, and what the operator sent,
          edited or dismissed.
        </li>
        <li>
          <strong>Host audio and camera frames — only when the seller turns the audio bridge on.</strong>{" "}
          The host's speech is transcribed, with the emotion and intent estimates measured on it, and
          the audio is kept in ten-second chunks. The video frames the copilot read are kept with
          what it read; frames it skipped are not. All of it lives on the SideStage server's disk.
        </li>
        <li>
          <strong>Listings, catalog and policies.</strong> The seller's own catalog, imported or
          uploaded, and lot data read from the show. Actions on listings — markdowns, stock
          changes, ended listings — are recorded in a hash-chained audit log.
        </li>
        <li>
          <strong>eBay tokens, if you connect an eBay account.</strong> OAuth tokens issued by eBay
          after you consent on eBay's own sign-in page. SideStage never sees your eBay password.
          Tokens are used only for the scopes you approved and are deleted when you disconnect.
        </li>
        <li>
          <strong>Account and settings.</strong> A display name for the operator, guardrail policy,
          automation preferences and spend limits.
        </li>
      </ul>

      <h2>Where it goes</h2>
      <ul>
        <li>
          <strong>Whissle</strong> hosts the language and speech agents. Catalog and policy
          documents are uploaded to a per-show agent's knowledge base; host audio is streamed to a
          listen-only session for transcription. Whissle's own policy applies to that processing.
        </li>
        <li>
          <strong>eBay</strong> receives API calls made on your behalf when you connect an account,
          and serves the public show pages SideStage reads.
        </li>
        <li>Nothing is sold, and nothing is used to train models.</li>
      </ul>

      <h2>How long</h2>
      <p>
        Everything about a show — chat, proposals, audit log, transcript, audio and frames — is kept
        until you delete the show, and deleting the show deletes it all, including the per-show
        Whissle agent and its knowledge base. Disconnecting eBay deletes the tokens. You can export
        a show as JSON at any time from its report.
      </p>

      <h2>Sandbox notice</h2>
      <p>
        SideStage currently runs against eBay's <em>sandbox</em> environment. Listings, prices and
        accounts there are test data; nothing it does reaches ebay.com buyers or sellers.
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
        SideStage is provided by Whissle AI as a working prototype for live-commerce sellers. By
        using it you agree to the following.
      </p>

      <h2>What it does, and does not</h2>
      <ul>
        <li>
          It drafts replies and proposes listing actions. <strong>The operator sends and approves.</strong>{" "}
          A reply that reaches a buyer, and an action that changes a listing, is the operator's
          decision — the copilot's guardrails reduce mistakes, they do not remove responsibility.
        </li>
        <li>
          Shows you do not own are monitored read-only: the copilot drafts and proposes, and never
          writes to a listing that is not yours or posts into a show's chat.
        </li>
        <li>
          Emotion and intent estimates on host speech are probabilities from a model, shown as such.
          They are not a judgment about a person.
        </li>
      </ul>

      <h2>Your accounts</h2>
      <p>
        You connect eBay through eBay's own consent screen and can revoke access there or by
        disconnecting in Settings. You are responsible for the listings and content in your account
        and for complying with eBay's user agreement.
      </p>

      <h2>Availability and warranty</h2>
      <p>
        The service is offered as-is, without warranty, and may change or stop at any time. It runs
        against eBay's sandbox; no real commerce is transacted through it.
      </p>

      <h2>Contact</h2>
      <p>Whissle AI · {CONTACT}</p>
    </Frame>
  );
}
