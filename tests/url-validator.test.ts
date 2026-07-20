import { describe, it, expect } from "vitest";
import { isValidWebhookUrl } from "../src/utils/url-validator";

describe("isValidWebhookUrl", () => {
  it("accepts a valid https URL", () => {
    expect(isValidWebhookUrl("https://example.com/webhook")).toEqual({ valid: true });
  });

  it("accepts a valid http URL", () => {
    expect(isValidWebhookUrl("http://hooks.internal.company.com/v1/events")).toEqual({ valid: true });
  });

  it("rejects file protocol", () => {
    const result = isValidWebhookUrl("file:///etc/passwd");
    expect(result.valid).toBe(false);
  });

  it("rejects ftp protocol", () => {
    const result = isValidWebhookUrl("ftp://files.example.com/upload");
    expect(result.valid).toBe(false);
  });

  it("rejects localhost", () => {
    const result = isValidWebhookUrl("http://localhost:8080/hook");
    expect(result.valid).toBe(false);
  });

  it("rejects 127.0.0.1", () => {
    const result = isValidWebhookUrl("http://127.0.0.1/hook");
    expect(result.valid).toBe(false);
  });

  it("rejects URLs with credentials", () => {
    const result = isValidWebhookUrl("https://user:pass@example.com/hook");
    expect(result.valid).toBe(false);
  });

  it("rejects malformed URLs", () => {
    const result = isValidWebhookUrl("not a url");
    expect(result.valid).toBe(false);
  });
});
