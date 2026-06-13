// Client-safe date helpers (no ".server" suffix). Kept separate so both the
// server render and the browser can format kickoff times consistently.

const UTC_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
};

const LOCAL_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
};

/** Deterministic UTC string used for SSR and the first client render. */
export function formatUtc(iso: string): string {
  return `${new Intl.DateTimeFormat("en-GB", UTC_FORMAT).format(new Date(iso))} UTC`;
}

/** Localized string shown after hydration, in the visitor's own time zone. */
export function formatLocal(iso: string): string {
  return new Intl.DateTimeFormat(undefined, LOCAL_FORMAT).format(new Date(iso));
}
