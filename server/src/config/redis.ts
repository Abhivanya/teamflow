import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let cacheClient: Redis | null = null;
let queueClient: Redis | null = null;

export async function connectRedis() {
  if (env.NODE_ENV === 'test') return;

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  try {
    await client.connect();
    cacheClient = client;
    queueClient = client.duplicate();
    logger.info('redis connected');
  } catch (error) {
    client.disconnect();
    logger.warn({ error }, 'redis unavailable, cache and queues will fall back');
  }
}

export function getRedis() {
  return cacheClient;
}

export function getQueueConnection() {
  return queueClient;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!cacheClient) return null;
  const raw = await cacheClient.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  if (!cacheClient) return;
  await cacheClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string) {
  if (!cacheClient) return;
  await cacheClient.del(key);
}

const memoryHits = new Map<string, { count: number; resetAt: number }>();

// Login/register limits. Redis when it is up, a small in-memory map otherwise
// so a single dev process is still protected.
export async function hitRateLimit(key: string, limit: number, windowSeconds: number) {
  if (cacheClient) {
    const redisKey = `rl:${key}`;
    const count = await cacheClient.incr(redisKey);
    if (count === 1) await cacheClient.expire(redisKey, windowSeconds);
    return count <= limit;
  }

  const now = Date.now();
  const current = memoryHits.get(key);
  if (!current || current.resetAt < now) {
    memoryHits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}
