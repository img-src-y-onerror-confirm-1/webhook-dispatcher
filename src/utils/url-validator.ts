import { logger } from "./logger";

const BLOCKED_PROTOCOLS = new Set(["file:", "ftp:", "data:", "javascript:"]);

export function isValidWebhookUrl(rawUrl: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: "malformed URL" };
  }

  if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
    return { valid: false, reason: `protocol ${parsed.protocol} not allowed` };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, reason: `only http and https are supported` };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, reason: "credentials in URL not allowed" };
  }

  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    return { valid: false, reason: "localhost not allowed" };
  }

  logger.debug({ url: rawUrl }, "url validation passed");
  return { valid: true };
}
