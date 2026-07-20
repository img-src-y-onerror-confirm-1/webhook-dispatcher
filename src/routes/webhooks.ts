import { Router, Request, Response } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { SubscriptionStore } from "../services/subscription";
import { RetryQueue } from "../services/retry-queue";
import { validatePayloadSize } from "../middleware/validate";

const createSubscriptionSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().optional(),
});

const dispatchEventSchema = z.object({
  eventType: z.string().min(1),
  payload: z.record(z.unknown()),
});

export function createWebhookRouter(
  subscriptions: SubscriptionStore,
  retryQueue: RetryQueue
) {
  const router = Router();

  router.post("/subscriptions", async (req: Request, res: Response) => {
    try {
      const body = createSubscriptionSchema.parse(req.body);
      const sub = {
        id: nanoid(),
        url: body.url,
        events: body.events,
        active: true,
        createdAt: Date.now(),
        secret: body.secret,
      };

      await subscriptions.create(sub);
      res.status(201).json({ id: sub.id, url: sub.url, events: sub.events });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "invalid_request", details: err.errors });
        return;
      }
      throw err;
    }
  });

  router.get("/subscriptions/:id", async (req: Request, res: Response) => {
    const sub = await subscriptions.get(req.params.id);
    if (!sub) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(sub);
  });

  router.delete("/subscriptions/:id", async (req: Request, res: Response) => {
    const deleted = await subscriptions.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).send();
  });

  router.post("/dispatch", validatePayloadSize, async (req: Request, res: Response) => {
    try {
      const body = dispatchEventSchema.parse(req.body);
      const subs = await subscriptions.getSubscribersForEvent(body.eventType);

      if (subs.length === 0) {
        res.json({ dispatched: 0, message: "no subscribers for this event" });
        return;
      }

      const payloadStr = JSON.stringify(body.payload);

      for (const sub of subs) {
        await retryQueue.enqueue({
          id: nanoid(),
          url: sub.url,
          payload: payloadStr,
          eventType: body.eventType,
          createdAt: Date.now(),
        });
      }

      res.json({ dispatched: subs.length, eventType: body.eventType });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "invalid_request", details: err.errors });
        return;
      }
      throw err;
    }
  });

  return router;
}
