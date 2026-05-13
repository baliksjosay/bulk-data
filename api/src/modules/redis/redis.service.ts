import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: this.config.get<string>('redis.password'),
      maxRetriesPerRequest: 3,
    });
  }

  /**
   * Initializes Redis connection listeners.
   */
  onModuleInit() {
    this.client.on('connect', () => this.logger.log('✅ Connected to Redis'));
    this.client.on('error', (err) => this.logger.error('❌ Redis error', err));
  }

  /**
   * Gracefully closes Redis connection.
   */
  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  /**
   * Returns the raw ioredis client instance.
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Creates a duplicate Redis connection (useful for pub/sub).
   */
  duplicate(): Redis {
    return this.client.duplicate();
  }

  /* ---------------- serialization helpers ---------------- */

  /**
   * Serializes a value before storing in Redis.
   * Strings are stored as-is, other types are JSON stringified.
   */
  private serialize(value: any): string {
    if (value === undefined) return 'null';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  /**
   * Safely deserializes a Redis value.
   * Falls back to raw string if JSON parsing fails.
   */
  private deserialize<T = any>(value: string | null): T | null {
    if (value === null) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /* ---------------- basic key/value ---------------- */

  /**
   * Sets a value in Redis with optional TTL.
   *
   * @param key Redis key
   * @param value Value to store (auto-serialized)
   * @param ttlSeconds Optional expiration time in seconds
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = this.serialize(value);

    if (ttlSeconds) {
      await this.client.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, serialized);
    }
  }

  /**
   * Retrieves a value from Redis.
   *
   * @param key Redis key
   * @returns Deserialized value or null if not found
   */
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return this.deserialize<T>(value);
  }

  /**
   * Deletes a key from Redis.
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Checks if a key exists.
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Sets expiration time for a key.
   *
   * @returns true if TTL was set successfully
   */
  async expire(key: string, ttlSec: number): Promise<boolean> {
    const result = await this.client.expire(key, ttlSec);
    return result === 1;
  }

  /**
   * Sets a key only if it does not exist (SETNX).
   *
   * @returns true if key was set, false if it already exists
   */
  async setnx(key: string, value: any, ttlSec?: number): Promise<boolean> {
    const serialized = this.serialize(value);
    const result = await this.client.setnx(key, serialized);

    if (result === 1 && ttlSec) {
      await this.client.expire(key, ttlSec);
    }

    return result === 1;
  }

  /* ---------------- multiple keys ---------------- */

  /**
   * Sets multiple key-value pairs at once.
   *
   * @param values Object of key-value pairs
   * @param ttlSeconds Optional TTL applied per key
   */
  async mset(values: Record<string, any>, ttlSeconds?: number): Promise<void> {
    const flat: string[] = [];

    for (const [k, v] of Object.entries(values)) {
      flat.push(k, this.serialize(v));
    }

    await this.client.mset(flat);

    if (ttlSeconds) {
      await Promise.all(
        Object.keys(values).map((k) => this.client.expire(k, ttlSeconds)),
      );
    }
  }

  /**
   * Retrieves multiple keys at once.
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const values = await this.client.mget(keys);
    return values.map((v) => this.deserialize<T>(v));
  }

  /**
   * Deletes multiple keys.
   */
  async mdel(keys: string[]): Promise<void> {
    if (!keys?.length) return;
    await this.client.del(...keys);
  }

  /* ---------------- pattern queries ---------------- */

  /**
   * Retrieves keys matching a pattern (blocking).
   * Avoid in production for large datasets.
   */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /**
   * Retrieves keys using SCAN (non-blocking).
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );

      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Retrieves keys for multiple patterns.
   */
  async getKeysByPatterns(patterns: string[]): Promise<string[]> {
    const allKeys = new Set<string>();

    for (const pattern of patterns) {
      let cursor = '0';

      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          200,
        );

        cursor = nextCursor;
        keys.forEach((k) => allKeys.add(k));
      } while (cursor !== '0');
    }

    return [...allKeys];
  }

  /**
   * Deletes keys matching a pattern.
   */
  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.getKeysByPattern(pattern);
    if (!keys.length) return 0;

    return this.client.del(...keys);
  }

  /**
   * Deletes keys matching multiple patterns.
   */
  async delByPatterns(patterns: string[]): Promise<number> {
    const keys = await this.getKeysByPatterns(patterns);
    if (!keys.length) return 0;

    await this.mdel(keys);
    return keys.length;
  }

  /* ---------------- atomic counters ---------------- */

  /**
   * Increments a numeric key.
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Decrements a numeric key.
   */
  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  /* ---------------- lists ---------------- */

  /**
   * Push value to the left of a list.
   */
  async lpush(key: string, value: any): Promise<void> {
    await this.client.lpush(key, this.serialize(value));
  }

  /**
   * Push value to the right of a list.
   */
  async rpush(key: string, value: any): Promise<void> {
    await this.client.rpush(key, this.serialize(value));
  }

  /**
   * Get a range of elements from a list.
   */
  async lrange<T = any>(key: string, start = 0, stop = -1): Promise<T[]> {
    const values = await this.client.lrange(key, start, stop);
    return values.map((v) => this.deserialize<T>(v));
  }

  /**
   * Trim a list to a specified range.
   */
  async ltrim(key: string, start: number, stop: number): Promise<void> {
    await this.client.ltrim(key, start, stop);
  }

  /**
   * Returns the length of a list.
   */
  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  /* ---------------- sets ---------------- */

  /**
   * Adds members to a set.
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  /**
   * Removes members from a set.
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  /**
   * Retrieves all members of a set.
   */
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  /**
   * Checks if a member exists in a set.
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  /* ---------------- pub/sub ---------------- */

  /**
   * Publishes a message to a Redis channel.
   */
  async publish(channel: string, message: any): Promise<number> {
    return this.client.publish(channel, this.serialize(message));
  }

  /**
   * Subscribes to a Redis channel.
   *
   * @param channel Channel name
   * @param handler Callback executed when a message is received
   * @returns Redis subscriber instance (caller must close if needed)
   */
  async subscribe(
    channel: string,
    handler: (message: any) => void,
  ): Promise<Redis> {
    const sub = this.duplicate();

    sub.on('message', (chan, msg) => {
      if (chan === channel) {
        handler(this.deserialize(msg));
      }
    });

    await sub.subscribe(channel);
    return sub;
  }

  /**
   * Sets a raw string value in Redis.
   */
  async setRaw(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.getClient().set(key, value, 'EX', ttlSeconds);
    } else {
      await this.getClient().set(key, value);
    }
  }

  /**
   * Retrieves a raw string value from Redis.
   */
  async getRaw(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }
}
