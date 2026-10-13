import clsx from "clsx";

// Small shared pieces for the Trending screens (no client JS of their own).

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

/** "Expires in 3 days" / "Expires in 5 hours" — shown to a video's owner. */
export function expiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = ms / 3_600_000;
  if (hours >= 48) return `Expires in ${Math.floor(hours / 24)} days`;
  if (hours >= 24) return "Expires in 1 day";
  if (hours >= 1) return `Expires in ${Math.floor(hours)} hour${Math.floor(hours) === 1 ? "" : "s"}`;
  return `Expires in ${Math.max(1, Math.floor(ms / 60_000))} min`;
}

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return src ? (
    // Avatars are already stored as small square WebP files.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={clsx("shrink-0 rounded-full bg-slate-200 object-cover", className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden="true"
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials || "?"}
    </span>
  );
}

const paths = {
  heart: "M12 21s-6.7-4.35-9.33-8.2C.6 9.9 1.4 6.2 4.6 4.9c2.1-.85 4.3-.1 5.6 1.6l1.8 2.3 1.8-2.3c1.3-1.7 3.5-2.45 5.6-1.6 3.2 1.3 4 5 2.9 7.9C18.7 16.65 12 21 12 21z",
  comment: "M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1h-9l-5 4v-4H4a1 1 0 01-1-1V6a1 1 0 011-1z",
  share: "M14 4l7 7-7 7v-4c-6 0-9 2-11 6 1-6 4-11 11-12V4z",
  message: "M3 11.5a8.5 8.5 0 0114.6-5.9A8.5 8.5 0 0112 20a8.6 8.6 0 01-4-.98L3 20l1.1-4.1A8.5 8.5 0 013 11.5z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  volumeOff: "M11 5L6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6",
  volumeOn: "M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13",
  play: "M8 5v14l11-7z",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  back: "M15 18l-6-6 6-6",
  send: "M4 12l16-8-6 16-2-7-8-1z",
} as const;

export function Icon({
  name,
  size = 24,
  filled = false,
  className,
}: {
  name: keyof typeof paths;
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  const stroked = !filled || name === "more" || name === "volumeOff" || name === "volumeOn" || name === "close" || name === "plus" || name === "back";
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      fill={filled && !stroked ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "more" ? 3.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
