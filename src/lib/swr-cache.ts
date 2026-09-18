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

/** Drops every entry in every cache, and discards any load already in
 * flight so its (possibly pre-write) result can't be stored afterwards. */
export function invalidateAllSwrCaches(): void {
  for (const store of stores.values()) clearStore(store);
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
    }
  ) {
    let store = stores.get(options.name);
    if (!store) {
      store = { entries: new Map(), inFlight: new Map(), generation: 0 };
      stores.set(options.name, store);
    }
    this.store = store;
  }

  clear(): void {
    clearStore(this.store);
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
