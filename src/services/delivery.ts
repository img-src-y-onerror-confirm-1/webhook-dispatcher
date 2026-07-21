import { request, Agent } from "undici";
import { readFileSync } from "fs";
import { getConfig } from "../config";
import { buildSignatureHeader } from "../utils/hmac";
import { logger } from "../utils/logger";

export interface DeliveryResult {
  statusCode: number;
  durationMs: number;
  success: boolean;
}

let cachedAgent: Agent | null = null;

function createTLSAgent(): Agent {
  if (cachedAgent) {
    return cachedAgent;
  }

  const config = getConfig();
  const agentOptions: any = {};

  if (config.WEBHOOK_IGNORE_SSL) {
    logger.warn(
      "WEBHOOK_IGNORE_SSL is enabled - certificate verification is disabled"
    );
    agentOptions.rejectUnauthorized = false;
  } else if (config.WEBHOOK_CA_CERT_PATH) {
    try {
      const caCert = readFileSync(config.WEBHOOK_CA_CERT_PATH, "utf-8");
      agentOptions.ca = caCert;
      logger.info(
        { path: config.WEBHOOK_CA_CERT_PATH },
        "custom CA certificate loaded"
      );
    } catch (err) {
      logger.error(
        { path: config.WEBHOOK_CA_CERT_PATH, err },
        "failed to read custom CA certificate file"
      );
      throw new Error(
        `Failed to read CA certificate from ${config.WEBHOOK_CA_CERT_PATH}: ${err}`
      );
    }
  }

  cachedAgent = new Agent(agentOptions);
  return cachedAgent;
}

export async function deliverWebhook(
  url: string,
  payload: string,
  eventType: string
): Promise<DeliveryResult> {
  const config = getConfig();
  const signature = buildSignatureHeader(payload);
  const start = Date.now();

  try {
    const agent = createTLSAgent();
    const response = await request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": eventType,
        "User-Agent": "webhook-dispatcher/2.1.0",
      },
      body: payload,
      headersTimeout: config.WEBHOOK_TIMEOUT_MS,
      bodyTimeout: config.WEBHOOK_TIMEOUT_MS,
      dispatcher: agent,
    });

    const durationMs = Date.now() - start;
    const success = response.statusCode >= 200 && response.statusCode < 300;

    await response.body.dump();

    logger.info(
      { url, statusCode: response.statusCode, durationMs, success },
      "webhook delivered"
    );

    return { statusCode: response.statusCode, durationMs, success };
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.warn({ url, err, durationMs }, "webhook delivery failed");
    return { statusCode: 0, durationMs, success: false };
  }
}
