/**
 * Key-value store abstraction for room state, with two implementations:
 *
 *   - MemoryStore   in-process Map. Zero setup, works out of the box for
 *                   local dev and for a single-instance deployment, but
 *                   does NOT share state across multiple serverless
 *                   instances -- fine for testing, not for real production
 *                   traffic on Vercel (which may route requests to
 *                   different instances).
 *   - UpstashStore  wraps @upstash/redis. Shared, persistent, works
 *                   correctly across any number of serverless instances.
 *                   Selected automatically when UPSTASH_REDIS_REST_URL and
 *                   UPSTASH_REDIS_REST_TOKEN are set.
 *
 * This split exists so the entire online-play feature can be built and
 * verified without needing real Upstash credentials, and upgrades to a real
 * shared store the moment those env vars are configured in production --
 * no code change required.
 */

import { Redis } from "@upstash/redis";

export interface RoomStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

class MemoryStore implements RoomStore {
  private data = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

class UpstashStore implements RoomStore {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get<T>(key);
    return value ?? null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, { ex: ttlSeconds });
  }
}

// A single store instance per process. In dev this persists across hot
// reloads via globalThis, matching the usual Next.js pattern for singletons
// (otherwise every file edit would wipe all in-memory rooms).
declare global {
  // eslint-disable-next-line no-var
  var __gadhaRoomStore: RoomStore | undefined;
}

export function getStore(): RoomStore {
  if (globalThis.__gadhaRoomStore) return globalThis.__gadhaRoomStore;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const store =
    url && token
      ? new UpstashStore(url, token)
      : new MemoryStore();

  if (!url || !token) {
    console.warn(
      "[gadha] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set -- " +
        "using an in-process memory store. Fine for local dev; on a real " +
        "multi-instance deployment, rooms will only be visible to whichever " +
        "instance created them. Set both env vars to use shared Redis."
    );
  }

  globalThis.__gadhaRoomStore = store;
  return store;
}
