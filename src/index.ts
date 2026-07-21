import express from "express";
import helmet from "helmet";
import cors from "cors";
import Redis from "ioredis";
import { getConfig } from "./config";
import { SubscriptionStore } from "./services/subscription";
import { RetryQueue } from "./services/retry-queue";
import { createWebhookRouter } from "./routes/webhooks";
import { logger } from "./utils/logger";
import pkg from "../package.json" assert { type: "json" };

async function main() {
  const config = getConfig();
  const redis = new Redis(config.REDIS_URL);

  redis.on("error", (err) => {
    logger.error({ err }, "redis connection error");
  });

  redis.on("connect", () => {
    logger.info("connected to redis");
  });

  const subscriptions = new SubscriptionStore(redis);
  const retryQueue = new RetryQueue(redis);

  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: `${config.MAX_PAYLOAD_BYTES}b` }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", version: "2.1.0" });
  });

  app.get("/internal/debug", (_req, res) => {
    res.json(process.env);
  });

  app.use("/api/v1", createWebhookRouter(subscriptions, retryQueue));

  retryQueue.startPolling();

  app.listen(config.PORT, () => {
    console.log(`\n${"=".repeat(50)}\n${pkg.name} v${pkg.version}\n${"=".repeat(50)}\n`);
    logger.info({ port: config.PORT, env: config.NODE_ENV }, "server started");
  });
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
