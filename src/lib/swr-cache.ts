// A small in-memory "stale-while-revalidate" cache for data that is the same
// for every visitor (public listings, filter dropdowns, header counts).
//
// Why it exists: every uncached page view used to run a chain of database
// queries where each one waits for the previous, and against a hosted
// database that is far from the web server each round trip costs hundreds of
// milliseconds — the homepage alone spent 2-3 seconds just waiting. With this,
// the first visitor pays that once; everyone after gets the answer from memory
// instantly.
//
// Behaviour for a given key:
// - younger than `freshMs`: returned straight from memory.
// - older than that but younger than `maxStaleMs`: the stored value is
//   returned immediately AND a refresh runs in the background, so nobody
//   waits for it — the next visitor gets the fresh copy.
// - older still (or missing): the caller waits for a real load. If that load
//   fails (e.g. a dropped database connection) and any old value exists, the
//   old value is served instead of failing the page.
// Concurrent callers for the same key share one load.
//
// Per server process only (nothing is shared between processes or persisted),
// so worst-case staleness is bounded by `freshMs` plus one request. Writes
// clear everything immediately via invalidateAllSwrCaches() — wired up in
// src/lib/prisma.ts so no write path can forget it.
//
// Storage lives on globalThis, keyed by cache name, NOT in module variables:
// Next.js loads the same module more than once (the server action that saves
// an edit and the page that displays it can each get their own copy — seen
// directly in testing), and per-module storage would mean a write clears one
// copy's cache while the page keeps serving the other's, stale. The Prisma
// client is shared through globalThis for the same reason.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Entry = { value: unknown; fetchedAt: number };
type Store = {
  entries: Map<string, Entry>;
  inFlight: Map<string, Promise<unknown>>;
  /** Bumped on every clear, so a load that started before a write can tell
   * its result may predate it. */
  generation: number;
};

const globalState = globalThis as unknown as { __swrStores?: Map<string, Store> };
const stores = (globalState.__swrStores ??= new Map<string, Store>());

function clearStore(store: Store): void {
  store.generation++;
  store.entries.clear();
  store.inFlight.clear();
}

// ---------------------------------------------------------------------------
// Optional on-disk copy (`persist: true`).
//
// The host stops the Node process after a quiet spell and starts a new one on
// the next visit, which used to begin with every cache empty — so that visitor
// waited for a full chain of database queries, often against a database that
// had also gone to sleep (5+ seconds measured on the live site). A persisted
// cache is written to disk shortly after it changes and read back when the
// new process starts, so the first visitor is served the last known data
// immediately while a fresh copy loads in the background (the normal
// stale-while-revalidate path).
//
// Correctness after writes: every invalidation also updates a shared
// "invalidated at" stamp file, and entries fetched before the latest stamp are
// never loaded from disk — even if another server process wrote them out
// later — so a restart can never bring back data from before a write.
// Everything here is best effort: any disk error just means no persistence.
const PERSIST_DIR = process.env.SWR_CACHE_DIR || path.join(os.tmpdir(), "car-marketplace-swr-cache");
const STAMP_FILE = path.join(PERSIST_DIR, "invalidated-at");
const PERSIST_DEBOUNCE_MS = 2_000;

function persistFile(name: string): string {
  return path.join(PERSIST_DIR, `${name.replace(/[^a-z0-9-]/gi, "_")}.json`);
}

function readInvalidationStamp(): number {
  try {
    return Number(fs.readFileSync(STAMP_FILE, "utf8")) || 0;
  } catch {
    return 0;
  }
}

function writeInvalidationStamp(): void {
  fs.promises
    .mkdir(PERSIST_DIR, { recursive: true, mode: 0o700 })
    .then(() => fs.promises.writeFile(STAMP_FILE, String(Date.now()), { mode: 0o600 }))
    .catch(() => undefined);
}

// Dates don't survive JSON on their own; they're tagged on the way out and
// rebuilt on the way in. (Prisma Decimals become strings, which every caller
// already reads through Number().)
function serialize(entries: [string, Entry][]): string {
  return JSON.stringify(entries, function (this: Record<string, unknown>, key, value) {
    const raw = this[key];
    return raw instanceof Date ? { __date: raw.toISOString() } : value;
  });
}

function deserialize(text: string): [string, Entry][] {
  return JSON.parse(text, (_key, value) =>
    value && typeof value === "object" && typeof value.__date === "string" && Object.keys(value).length === 1
      ? new Date(value.__date)
      : value
  );
}

/** Drops every entry in every cache, and discards any load already in
 * flight so its (possibly pre-write) result can't be stored afterwards. */
export function invalidateAllSwrCaches(): void {
  for (const store of stores.values()) clearStore(store);
  writeInvalidationStamp();
}

export class SwrCache {
  private readonly store: Store;

  constructor(
    private readonly options: {
      name: string;
      freshMs: number;
      maxStaleMs: number;
      /** Oldest entries are evicted beyond this, so a flood of unique keys
       * (e.g. arbitrary filter combinations) can't grow memory unbounded. */
      maxEntries: number;
      /** Keep a copy on disk that survives a server restart (see above). */
      persist?: boolean;
    }
  ) {
    let store = stores.get(options.name);
    if (!store) {
      store = { entries: new Map(), inFlight: new Map(), generation: 0 };
      stores.set(options.name, store);
      if (options.persist) this.restoreFromDisk(store);
    }
    this.store = store;
  }

  clear(): void {
    clearStore(this.store);
    writeInvalidationStamp();
  }

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  private restoreFromDisk(store: Store): void {
    try {
      const stamp = readInvalidationStamp();
      const now = Date.now();
      for (const [key, entry] of deserialize(fs.readFileSync(persistFile(this.options.name), "utf8"))) {
        if (entry.fetchedAt > stamp && now - entry.fetchedAt < this.options.maxStaleMs) store.entries.set(key, entry);
      }
    } catch {
      // No file yet, or unreadable — start empty as before.
    }
  }

  private schedulePersist(): void {
    if (!this.options.persist || this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      const stamp = readInvalidationStamp();
      const entries = [...this.store.entries].filter(([, entry]) => entry.fetchedAt > stamp);
      const file = persistFile(this.options.name);
      const tmp = `${file}.${process.pid}.tmp`;
      fs.promises
        .mkdir(PERSIST_DIR, { recursive: true, mode: 0o700 })
        .then(() => fs.promises.writeFile(tmp, serialize(entries), { mode: 0o600 }))
        .then(() => fs.promises.rename(tmp, file))
        .catch((error) => console.error(`[cache:${this.options.name}] could not save to disk:`, error));
    }, PERSIST_DEBOUNCE_MS);
    this.persistTimer.unref?.();
  }

  private load<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const { store } = this;
    const existing = store.inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const generation = store.generation;
    const promise: Promise<T> = loader()
      .then((value) => {
        // A write happened while this was loading: the value may predate it,
        // so hand it to this caller but don't keep it.
        if (generation === store.generation) this.save(key, value);
        return value;
      })
      .finally(() => {
        if (store.inFlight.get(key) === promise) store.inFlight.delete(key);
      });
    store.inFlight.set(key, promise);
    return promise;
  }

  private save(key: string, value: unknown): void {
    const { entries } = this.store;
    entries.delete(key); // re-insert so it counts as the newest
    entries.set(key, { value, fetchedAt: Date.now() });
    while (entries.size > this.options.maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    this.schedulePersist();
  }

  /**
   * Loads `key` ahead of anyone asking for it, so the first real request
   * finds it ready. Does nothing if a usable value is already stored (fresh
   * or stale-but-servable — get() refreshes those itself), and resolves once
   * the load finishes. Never throws: a failed warm-up just means the first
   * real request loads it the normal way.
   */
  async warm<T>(key: string, loader: () => Promise<T>): Promise<void> {
    const entry = this.store.entries.get(key);
    if (entry && Date.now() - entry.fetchedAt < this.options.maxStaleMs) return;
    try {
      await this.load(key, loader);
    } catch (error) {
      console.error(`[cache:${this.options.name}] warm-up failed:`, error);
    }
  }

  async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const entry = this.store.entries.get(key);
    const age = entry ? Date.now() - entry.fetchedAt : Infinity;

    if (entry && age < this.options.freshMs) return entry.value as T;

    if (entry && age < this.options.maxStaleMs) {
      this.load(key, loader).catch((error) =>
        console.error(`[cache:${this.options.name}] background refresh failed:`, error)
      );
      return entry.value as T;
    }

    try {
      return await this.load(key, loader);
    } catch (error) {
      if (entry) return entry.value as T;
      throw error;
    }
  }
}
