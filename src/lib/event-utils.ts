import { slugify } from "@/lib/slugify";

// ----------------------------------------------------------------------------
// Pure helpers for event dates, ordering and URLs (no server-only imports, so
// the admin form, the public pages, the sitemap and tests can all share them).
//
// WHY TIME LIVES INSIDE `eventDate`: the Event table has one nullable
// DateTime column and production's schema only changes via `prisma migrate
// deploy`, which isn't part of the Hostinger build — a new column the code
// reads but production lacks would break every events query and the sitemap.
// So the existing column carries both facts:
//
//   - date only (every event created before time existed, and any new event
//     saved without a time): stored as UTC midnight of the calendar date,
//     exactly as before. Midnight UTC therefore means "no time set".
//   - date + time: stored as the real instant, with the time entered in
//     East Africa Time (Kenya is UTC+3 all year, no daylight saving).
//
// The one value that cannot be represented as a timed event is exactly
// 03:00 EAT (that instant IS midnight UTC) — it is nudged by one second,
// which is invisible, rather than being mistaken for "no time".
// ----------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const EAT_OFFSET_ISO = "+03:00";

/** "YYYY-MM-DD" (+ optional "HH:mm" East Africa Time) → the value to store. */
export function combineEventDateTime(date: string, time?: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  if (!time) return new Date(Date.UTC(y, m - 1, d));
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  let ms = Date.UTC(y, m - 1, d, hh, mm) - EAT_OFFSET_MS;
  if (ms % DAY_MS === 0) ms += 1000;
  return new Date(ms);
}

export type EventWhen = {
  /** Calendar date as the event's audience sees it, "YYYY-MM-DD". */
  dateKey: string;
  /** "HH:mm" in East Africa Time, or null when the event has no time. */
  time: string | null;
  /** Sort key: the start instant (start of the day for date-only events). */
  startMs: number;
  /** First instant after the event's calendar day (Nairobi midnight). */
  dayEndMs: number;
};

export function describeEventDate(eventDate: Date): EventWhen {
  const ms = eventDate.getTime();
  const hasTime = ms % DAY_MS !== 0;
  const local = new Date(hasTime ? ms + EAT_OFFSET_MS : ms).toISOString();
  const dateKey = local.slice(0, 10);
  const nairobiMidnightMs = Date.parse(`${dateKey}T00:00:00Z`) - EAT_OFFSET_MS;
  return {
    dateKey,
    time: hasTime ? local.slice(11, 16) : null,
    startMs: hasTime ? ms : nairobiMidnightMs,
    dayEndMs: nairobiMidnightMs + DAY_MS,
  };
}

/** Values for the admin form's date and time inputs. */
export function splitEventDate(eventDate: Date | null): { date: string; time: string } {
  if (!eventDate) return { date: "", time: "" };
  const when = describeEventDate(eventDate);
  return { date: when.dateKey, time: when.time ?? "" };
}

export function formatEventDate(dateKey: string, style: "short" | "long" = "long"): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "14:30" → "2:30 PM". */
export function formatEventTime(time: string): string {
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const suffix = hh >= 12 ? "PM" : "AM";
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/** schema.org startDate: a plain date for date-only events, a full
 * date-time with the +03:00 offset otherwise. */
export function eventStartIso(eventDate: Date): string {
  const when = describeEventDate(eventDate);
  return when.time ? `${when.dateKey}T${when.time}:00${EAT_OFFSET_ISO}` : when.dateKey;
}

type Dated = { eventDate: Date | null; createdAt: Date };

/**
 * Splits events for display: `upcoming` is soonest-first (an event stays
 * upcoming for the whole of its day, Nairobi time), with events that have no
 * date after the dated ones; `past` is most-recent-first, so the latest past
 * event is nearest the upcoming ones.
 */
export function groupEventsByTime<T extends Dated>(events: T[], now: Date = new Date()) {
  const dated: { event: T; when: EventWhen }[] = [];
  const undated: T[] = [];
  for (const event of events) {
    if (event.eventDate) dated.push({ event, when: describeEventDate(event.eventDate) });
    else undated.push(event);
  }

  const nowMs = now.getTime();
  const upcomingDated = dated.filter(({ when }) => when.dayEndMs > nowMs).sort((a, b) => a.when.startMs - b.when.startMs);
  const past = dated.filter(({ when }) => when.dayEndMs <= nowMs).sort((a, b) => b.when.startMs - a.when.startMs);
  undated.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    upcoming: [...upcomingDated.map(({ event }) => event), ...undated],
    past: past.map(({ event }) => event),
  };
}

/** Canonical, readable URL: /events/<title-words>-<id>. Ids (cuids) never
 * contain a dash, so the id is always whatever follows the last one. */
export function eventPath(event: { id: string; title: string }): string {
  const slug = slugify(event.title).slice(0, 60).replace(/-+$/, "") || "event";
  return `/events/${slug}-${event.id}`;
}

/** The event id from a /events/[param] segment — either the new
 * "<slug>-<id>" form or a bare id from an older link. */
export function eventIdFromParam(param: string): string {
  return param.slice(param.lastIndexOf("-") + 1);
}
