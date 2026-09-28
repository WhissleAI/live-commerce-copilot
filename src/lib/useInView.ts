import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Has this element come near the viewport yet?
 *
 * Replaces `loading="lazy"` on the report's frame thumbnails, where the native
 * attribute does not fire. Measured on production: 34 thumbnails, one of them
 * plainly visible on screen, polled every two seconds for fourteen seconds —
 * `complete: false` and `currentSrc: ""` throughout, no error, no console
 * warning, no broken-image icon. The same URLs return `200 image/jpeg` to
 * `fetch`, and the same element loads at 640px the moment `loading` is
 * removed. It is the attribute, inside this feed's scroll container, that
 * never resolves.
 *
 * An observer we own is not a workaround for that — it is the thing that can
 * be reasoned about and tested. `rootMargin` keeps the prefetch-ahead the
 * attribute was there for, so a long show still does not fetch every frame at
 * once.
 *
 * Latches: once seen, stays seen, so scrolling back does not re-fetch.
 */
export function useInView(rootMargin = "300px"): [(el: Element | null) => void, boolean] {
  const [seen, setSeen] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => () => observer.current?.disconnect(), []);

  const ref = useCallback(
    (el: Element | null) => {
      observer.current?.disconnect();
      if (!el || seen) return;
      // No IntersectionObserver (jsdom, an old browser): show it rather than
      // hide it. A thumbnail fetched too eagerly is a smaller failure than one
      // that never appears.
      if (typeof IntersectionObserver === "undefined") {
        setSeen(true);
        return;
      }
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setSeen(true);
            observer.current?.disconnect();
          }
        },
        { rootMargin },
      );
      observer.current.observe(el);
    },
    [seen, rootMargin],
  );

  return [ref, seen];
}
