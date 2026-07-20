import crypto from "crypto";
import { getConfig } from "../config";

export function signPayload(payload: string): string {
  const config = getConfig();
  return crypto
    .createHmac("sha256", config.HMAC_SECRET)
    .update(payload)
    .digest("hex");
}

export function buildSignatureHeader(payload: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(`${timestamp}.${payload}`);
  return `t=${timestamp},v1=${signature}`;
}
