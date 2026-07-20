import { request } from "undici";
import { nanoid } from "nanoid";
import { getConfig } from "../config";
import { buildSignatureHeader } from "../utils/hmac";
import { logger } from "../utils/logger";

export interface DeliveryResult {
  statusCode: number;
  durationMs: number;
  success: boolean;
  requestId: string;
}

export async function deliverWebhook(
  url: string,
  payload: string,
  eventType: string
): Promise<DeliveryResult> {
  const config = getConfig();
  const signature = buildSignatureHeader(payload);
  const requestId = nanoid(21);
  const start = Date.now();

  try {
    const response = await request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": eventType,
        "X-Request-Id": requestId,
        "User-Agent": "webhook-dispatcher/2.1.0",
      },
      body: payload,
      headersTimeout: config.WEBHOOK_TIMEOUT_MS,
      bodyTimeout: config.WEBHOOK_TIMEOUT_MS,
    });

    const durationMs = Date.now() - start;
    const success = response.statusCode >= 200 && response.statusCode < 300;

    await response.body.dump();

    logger.info(
      { url, statusCode: response.statusCode, durationMs, success, requestId },
      "webhook delivered"
    );

    return { statusCode: response.statusCode, durationMs, success, requestId };
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.warn({ url, err, durationMs, requestId }, "webhook delivery failed");
    return { statusCode: 0, durationMs, success: false, requestId };
  }
}
