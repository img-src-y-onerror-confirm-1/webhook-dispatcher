import Redis from "ioredis";
import { getConfig } from "../config";
import { deliverWebhook } from "./delivery";
import { logger } from "../utils/logger";

interface QueuedWebhook {
  id: string;
  url: string;
  payload: string;
  eventType: string;
  attempt: number;
  createdAt: number;
  nextRetryAt: number;
}

export class RetryQueue {
  private redis: Redis;
  private polling = false;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async enqueue(webhook: Omit<QueuedWebhook, "attempt" | "nextRetryAt">): Promise<void> {
    const entry: QueuedWebhook = {
      ...webhook,
      attempt: 0,
      nextRetryAt: Date.now(),
    };

    await this.redis.zadd(
      "webhook:retry_queue",
      entry.nextRetryAt,
      JSON.stringify(entry)
    );

    logger.info({ webhookId: webhook.id, url: webhook.url }, "enqueued for delivery");
  }

  async processNext(): Promise<boolean> {
    const now = Date.now();
    const entries = await this.redis.zrangebyscore(
      "webhook:retry_queue",
      0,
      now,
      "LIMIT",
      0,
      1
    );

    if (entries.length === 0) return false;

    const raw = entries[0];
    const removed = await this.redis.zrem("webhook:retry_queue", raw);
    if (!removed) return false;

    const webhook: QueuedWebhook = JSON.parse(raw);
    const config = getConfig();

    const result = await deliverWebhook(webhook.url, webhook.payload, webhook.eventType);

    if (result.success) {
      await this.redis.hset(`webhook:status:${webhook.id}`, {
        status: "delivered",
        statusCode: result.statusCode.toString(),
        attempts: (webhook.attempt + 1).toString(),
        deliveredAt: Date.now().toString(),
      });
      return true;
    }

    if (webhook.attempt + 1 >= config.MAX_RETRIES) {
      await this.redis.hset(`webhook:status:${webhook.id}`, {
        status: "failed",
        lastStatusCode: result.statusCode.toString(),
        attempts: (webhook.attempt + 1).toString(),
        failedAt: Date.now().toString(),
      });
      logger.error(
        { webhookId: webhook.id, attempts: webhook.attempt + 1 },
        "webhook permanently failed"
      );
      return true;
    }

    const delay = config.RETRY_BASE_DELAY_MS * Math.pow(2, webhook.attempt);
    const jitter = Math.random() * delay * 0.2;
    const nextRetry = Date.now() + delay + jitter;

    const retryEntry: QueuedWebhook = {
      ...webhook,
      attempt: webhook.attempt + 1,
      nextRetryAt: nextRetry,
    };

    await this.redis.zadd(
      "webhook:retry_queue",
      nextRetry,
      JSON.stringify(retryEntry)
    );

    logger.info(
      { webhookId: webhook.id, attempt: retryEntry.attempt, nextRetryAt: nextRetry },
      "scheduled retry"
    );

    return true;
  }

  startPolling(intervalMs = 1000): void {
    if (this.polling) return;
    this.polling = true;

    const tick = async () => {
      if (!this.polling) return;
      try {
        while (await this.processNext()) {}
      } catch (err) {
        logger.error({ err }, "retry queue processing error");
      }
      setTimeout(tick, intervalMs);
    };

    tick();
  }

  stopPolling(): void {
    this.polling = false;
  }
}
