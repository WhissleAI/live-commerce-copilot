/**
 * What a link to SideStage says when it is not the page itself.
 *
 * CONTENT-11. The live site's `<meta name="description">` and `og:description`
 * were the pre-multisurface pitch — "A copilot for eBay Live sellers: it
 * watches the show… behind six guards" — so every Google result, Slack unfurl,
 * LinkedIn preview and browser tab sold a single-surface eBay product in the
 * retired vocabulary. The page body it fronts says at `LandingPage.tsx:11-14`
 * that "a hero that names one of them is a hero that is wrong about the rest".
 *
 * It was also written twice — `routes/index.tsx` and `routes/__root.tsx` had
 * divergent copies, and the root's was shorter and older. One constant now,
 * imported by both, because two copies of a sentence is how the first one went
 * stale without anybody noticing.
 *
 * CONTENT-12. `twitter:card: summary_large_image` was declared with no
 * `og:image` and no `twitter:image` anywhere, so a large-card unfurl rendered
 * a blank image slot. `public/landing/console.jpg` has shipped all along and
 * is the screenshot the page leads with.
 */

export const SITE_NAME = "SideStage";

export const SITE_TITLE = "SideStage — a copilot for the room you are answering";

/**
 * Multisurface, and in the product's own nouns. "Six guards" is right and
 * stays: six run on every drafted reply and two more run where the surface has
 * them — `BASE_GUARDS` in `lib/surfaces.ts`, and `guardOrderFor` beside it.
 */
export const SITE_DESCRIPTION =
  "One copilot across a live show, a stream, a subreddit and your own follow-up inbox. It reads the conversation, answers out of your listings and policies, names the fact it used, and runs six deterministic guards before you see the draft. Nothing is posted for you.";

export const SITE_TAGLINE = "It answers the room, wherever the room is. You keep the last word.";

/** Shipped in `public/`, and the shot the landing page opens with. */
export const SITE_IMAGE = "/landing/console.jpg";

export const SITE_IMAGE_ALT =
  "The SideStage console on a live show: buyer chat on the left, drafted replies with their guard verdicts in the middle, the pinned lot on the right";

/**
 * The tags every route head shares. A route may add to these; nothing should
 * restate them.
 */
export function siteMeta(): { name?: string; property?: string; content: string }[] {
  return [
    { name: "description", content: SITE_DESCRIPTION },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: SITE_TITLE },
    { property: "og:description", content: SITE_TAGLINE },
    { property: "og:type", content: "website" },
    { property: "og:image", content: SITE_IMAGE },
    { property: "og:image:alt", content: SITE_IMAGE_ALT },
    // Declared only now that there is an image to fill it.
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: SITE_TITLE },
    { name: "twitter:description", content: SITE_TAGLINE },
    { name: "twitter:image", content: SITE_IMAGE },
    { name: "twitter:image:alt", content: SITE_IMAGE_ALT },
  ];
}
