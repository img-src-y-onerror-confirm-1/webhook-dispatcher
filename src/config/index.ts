import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3100),
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(10000),
  MAX_RETRIES: z.coerce.number().default(5),
  RETRY_BASE_DELAY_MS: z.coerce.number().default(1000),
  MAX_PAYLOAD_BYTES: z.coerce.number().default(262144),
  HMAC_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = envSchema.parse(process.env);
  }
  return _config;
}
