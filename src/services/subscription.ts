import Redis from "ioredis";
import { logger } from "../utils/logger";

export interface Subscription {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: number;
  secret?: string;
  timeoutMs?: number;
}

export class SubscriptionStore {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async create(sub: Subscription): Promise<void> {
    await this.redis.hset(
      `webhook:sub:${sub.id}`,
      "data",
      JSON.stringify(sub)
    );

    for (const event of sub.events) {
      await this.redis.sadd(`webhook:event:${event}`, sub.id);
    }

    logger.info({ subId: sub.id, url: sub.url, events: sub.events }, "subscription created");
  }

  async get(id: string): Promise<Subscription | null> {
    const raw = await this.redis.hget(`webhook:sub:${id}`, "data");
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async getSubscribersForEvent(eventType: string): Promise<Subscription[]> {
    const ids = await this.redis.smembers(`webhook:event:${eventType}`);
    const subs: Subscription[] = [];

    for (const id of ids) {
      const sub = await this.get(id);
      if (sub && sub.active) subs.push(sub);
    }

    return subs;
  }

  async deactivate(id: string): Promise<boolean> {
    const sub = await this.get(id);
    if (!sub) return false;

    sub.active = false;
    await this.redis.hset(`webhook:sub:${id}`, "data", JSON.stringify(sub));
    logger.info({ subId: id }, "subscription deactivated");
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const sub = await this.get(id);
    if (!sub) return false;

    for (const event of sub.events) {
      await this.redis.srem(`webhook:event:${event}`, id);
    }
    await this.redis.del(`webhook:sub:${id}`);

    logger.info({ subId: id }, "subscription deleted");
    return true;
  }
}
