import "server-only";
import { prisma } from "@/lib/prisma";
import { SwrCache } from "@/lib/swr-cache";
import { requireRole, AuthorizationError } from "@/server/authorization/ownership";
import { saveEventImage, deleteEventImage, InvalidImageError } from "@/lib/storage";
import { createEventSchema, updateEventSchema, type CreateEventInput, type UpdateEventInput } from "@/server/validation/event-schema";

// ----------------------------------------------------------------------------
// Events — admin-authored marketplace/community event posts (car shows,
// dealer days, promotions), shown publicly at /events. The ONLY module that
// writes to the Event table, same convention as listing-service.ts owning
// CarListing. Every mutation requires ADMIN — sellers/buyers can view
// published events but never create/edit them (spec: "admin will be
// posting upcoming events").
// ----------------------------------------------------------------------------

// Public reads are the same for every visitor, so they're kept in memory
// (see lib/swr-cache.ts) instead of costing a database round trip on every
// page view. Any write to these tables clears it (see lib/prisma.ts).
const publicCache = new SwrCache({ name: "public-events", freshMs: 30_000, maxStaleMs: 24 * 60 * 60_000, maxEntries: 200 });

/** Public: every published event (the page groups and orders them into
 * upcoming and past per request — see groupEventsByTime in lib/event-utils.ts
 * — so what's cached here never goes stale as the calendar moves on). */
export async function getPublishedEvents() {
  return publicCache.get("all", () =>
    prisma.event.findMany({
      where: { published: true },
      orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
    })
  );
}

/** Public: a single published event by id — used by the detail page. Never
 * returns an unpublished event to a non-admin (returns null instead, same
 * "not found" treatment as a bad id, so a draft event's existence isn't
 * leaked). */
export async function getPublishedEventById(id: string) {
  return publicCache.get(`id:${id}`, () => prisma.event.findFirst({ where: { id, published: true } }));
}

const ADMIN_PAGE_SIZE = 20;

/** Admin-only: every event regardless of published state. */
export async function getAllEventsForAdmin({ page = 1 }: { page?: number } = {}) {
  await requireRole("ADMIN");
  const safePage = Math.max(1, page);

  const [events, totalCount] = await Promise.all([
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.event.count(),
  ]);

  return {
    events,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE)),
    page: safePage,
  };
}

export async function getEventForAdmin(id: string) {
  await requireRole("ADMIN");
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw new AuthorizationError("Event not found.");
  return event;
}

/** Creates a new event, DRAFT (unpublished) by default — an admin
 * publishes it as a deliberate second step once it's ready, rather than a
 * half-written post going live the moment "Create" is clicked. */
export async function createEvent(input: CreateEventInput, imageFile: File | null) {
  const admin = await requireRole("ADMIN");
  const data = createEventSchema.parse(input);

  let image: { imageUrl: string; storageKey: string } | null = null;
  if (imageFile && imageFile.size > 0) {
    image = await saveEventImage(imageFile);
  }

  return prisma.event.create({
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      eventDate: data.eventDate,
      imageUrl: image?.imageUrl,
      createdById: admin.id,
    },
  });
}

export async function updateEvent(id: string, input: UpdateEventInput, imageFile: File | null) {
  await requireRole("ADMIN");
  const data = updateEventSchema.parse(input);

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new AuthorizationError("Event not found.");

  let imageUrl = existing.imageUrl;
  if (imageFile && imageFile.size > 0) {
    const image = await saveEventImage(imageFile);
    imageUrl = image.imageUrl;
    // Old file is orphaned on disk otherwise — clean it up the same way
    // listing-service.ts does when an image is replaced. Never fatal: a
    // failed delete of the old file must not block the successful update.
    if (existing.imageUrl) {
      const oldKey = existing.imageUrl.split("/").pop();
      if (oldKey) await deleteEventImage(oldKey).catch(() => {});
    }
  }

  return prisma.event.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      // `?? null`, not the bare value: Prisma treats `undefined` as "leave
      // unchanged", so without it an admin who emptied the date or location
      // field saw "Saved." while the old value quietly stayed.
      location: data.location ?? null,
      eventDate: data.eventDate ?? null,
      imageUrl,
    },
  });
}

/** Toggles visibility — the only lifecycle control for an event (see the
 * Event model's own comment for why there's no delete action). */
export async function setEventPublished(id: string, published: boolean) {
  await requireRole("ADMIN");
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new AuthorizationError("Event not found.");

  return prisma.event.update({ where: { id }, data: { published } });
}

export { InvalidImageError };
