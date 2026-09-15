/**
 * The mark — the wing beside the stage.
 *
 * Exported from the brand file (Figma · 01 · Logo · Logo/Mark). The stage is
 * the show on a phone; the wing is the one beside it, standing just off
 * camera. The red dot is ON AIR: it is lit on the mark wherever a show can be
 * running, and dark on the mono variants used for print and favicons.
 */

const STAGE =
  "M101.25 35.625C101.25 28.3763 95.3737 22.5 88.125 22.5H61.875C54.6263 22.5 48.75 28.3763 48.75 35.625V84.375C48.75 91.6237 54.6263 97.5 61.875 97.5H88.125C95.3737 97.5 101.25 91.6237 101.25 84.375V35.625ZM108.75 84.375C108.75 95.7659 99.5159 105 88.125 105H61.875C50.4841 105 41.25 95.7659 41.25 84.375V35.625C41.25 24.2341 50.4841 15 61.875 15H88.125C99.5159 15 108.75 24.2341 108.75 35.625V84.375Z";
const WING =
  "M30 25.3125C30 19.6171 25.3829 15 19.6875 15C13.9921 15 9.375 19.6171 9.375 25.3125V94.6875C9.375 100.383 13.9921 105 19.6875 105C25.3829 105 30 100.383 30 94.6875V25.3125Z";
const DOT =
  "M19.6875 34.125C23.0012 34.125 25.6875 31.4387 25.6875 28.125C25.6875 24.8113 23.0012 22.125 19.6875 22.125C16.3738 22.125 13.6875 24.8113 13.6875 28.125C13.6875 31.4387 16.3738 34.125 19.6875 34.125Z";

const INK: Record<NonNullable<LogoMarkProps["variant"]>, string> = {
  green: "#124E3F",
  mint: "#ABFFEA",
  white: "#FFFFFF",
};

export interface LogoMarkProps {
  size?: number;
  /** green on light · mint on dark · mono white */
  variant?: "green" | "mint" | "white";
  /** The red dot. Off for mono use. */
  onAir?: boolean;
  className?: string;
  title?: string;
}

export function LogoMark({ size = 24, variant = "green", onAir = true, className, title }: LogoMarkProps) {
  const ink = INK[variant];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d={STAGE} fill={ink} />
      <path d={WING} fill={ink} />
      <path d={DOT} fill={onAir ? "#F14E52" : ink} />
    </svg>
  );
}

/** Horizontal lockup — mark + wordmark, for the nav and product chrome. */
export function LogoLockup({
  size = 22,
  variant = "green",
  className,
}: {
  size?: number;
  variant?: "green" | "mint" | "white";
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} variant={variant} />
      <span
        className="font-[Archivo,Inter,sans-serif] font-bold tracking-[-0.02em]"
        style={{ fontSize: Math.round(size * 0.82), color: variant === "green" ? "#0F1E1A" : "#FFFFFF" }}
      >
        SideStage
      </span>
    </span>
  );
}
