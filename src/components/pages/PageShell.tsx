/**
 * Two layout primitives that predate the shell, kept because two long pages are
 * built out of them.
 *
 * They used to draw themselves: an uppercase, letter-spaced heading and a
 * bordered stat box, from before the design settled on one section heading and
 * one tile. The names stay so Settings and Analytics do not need rewriting;
 * what they draw is now the same `SectionHeading` and `StatTile` every other
 * screen uses. A design system that only applies to new screens is not one.
 *
 * The `PageShell` frame that lived here — its own sticky header, its own back
 * link, its own account menu — is gone. `AppShell` is the frame now, and a
 * second one competing with it was how Analytics and Settings ended up looking
 * like a different product.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SectionHeading, StatTile } from "@/components/ui/kit";

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <SectionHeading hint={hint}>{title}</SectionHeading>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A number with its unit and a one-line explanation of what it means. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "ok" | "warn" | "bad" | undefined;
}) {
  return (
    <StatTile label={label} value={value} {...(hint ? { hint } : {})} {...(tone ? { tone } : {})} />
  );
}
