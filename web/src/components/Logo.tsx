import { BRAND } from "../brand";

/**
 * CarHistoryIL logo — navy car silhouette with speed lines + wordmark, modeled
 * on the brand reference. Clickable: returns to the homepage when `onHome` is
 * provided (falls back to an anchor to "/").
 */
export function Logo({
  onHome,
  showWordmark = true,
  className = "",
}: {
  onHome?: () => void;
  showWordmark?: boolean;
  className?: string;
}) {
  const inner = (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 120 56" className="h-8 w-auto" role="img" aria-label={BRAND.name}>
        {/* car body */}
        <path
          d="M14 40c-3 0-5-2-5-5 0-2 1-4 4-5l10-3c5-5 12-10 22-11 9-1 16 2 22 7l14 1c4 .4 7 2 9 5l2 4c.5 2-1 4-3 4H14z"
          fill="#26384f"
        />
        {/* greenhouse cutout */}
        <path d="M40 16c7-1 13 1 18 5l-30 3c4-4 8-7 12-8z" fill="#fff" opacity="0.9" />
        {/* wheels */}
        <circle cx="30" cy="40" r="6" fill="#26384f" />
        <circle cx="30" cy="40" r="2.4" fill="#fff" />
        <circle cx="72" cy="40" r="6" fill="#26384f" />
        <circle cx="72" cy="40" r="2.4" fill="#fff" />
        {/* speed lines */}
        <rect x="86" y="22" width="26" height="4" rx="2" fill="#26384f" />
        <rect x="92" y="29" width="20" height="4" rx="2" fill="#9fb2c4" />
        <rect x="98" y="36" width="14" height="4" rx="2" fill="#c7d3df" />
      </svg>
      {showWordmark && (
        <span className="text-lg font-extrabold tracking-tight text-[#26384f]">
          CAR<span className="text-brand-600">HISTORY</span>IL
        </span>
      )}
    </span>
  );

  if (onHome) {
    return (
      <button onClick={onHome} aria-label="חזרה לדף הבית" className="transition hover:opacity-80">
        {inner}
      </button>
    );
  }
  return (
    <a href="/" aria-label="חזרה לדף הבית" className="transition hover:opacity-80">
      {inner}
    </a>
  );
}
