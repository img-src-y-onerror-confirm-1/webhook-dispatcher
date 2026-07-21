import { describe, it, expect } from "vitest";
import { z } from "zod";

const createSubscriptionSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      "URL contains invalid characters"
    ),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().optional(),
});

describe("Webhook URL handling with special characters", () => {
  it("should accept valid URLs with encoded special characters", () => {
    const body = {
      url: "https://example.com/webhook?token=abc&id=123",
      events: ["test.event"],
    };
    expect(() => createSubscriptionSchema.parse(body)).not.toThrow();
  });

  it("should accept URLs with encoded special characters in path", () => {
    const body = {
      url: "https://example.com/webhook/path%20with%20spaces",
      events: ["test.event"],
    };
    expect(() => createSubscriptionSchema.parse(body)).not.toThrow();
  });

  it("should reject URLs with pipe character in query parameters", () => {
    const body = {
      url: "https://example.com/webhook?token=abc|def",
      events: ["test.event"],
    };
    expect(() => createSubscriptionSchema.parse(body)).toThrow("URL contains invalid characters");
  });

  it("should reject URLs with unencoded braces", () => {
    const body = {
      url: "https://example.com/webhook?param=value{1,2}",
      events: ["test.event"],
    };
    expect(() => createSubscriptionSchema.parse(body)).toThrow("URL contains invalid characters");
  });

  it("should reject URLs with unencoded spaces", () => {
    const body = {
      url: "https://example.com/webhook?param=value with spaces",
      events: ["test.event"],
    };
    expect(() => createSubscriptionSchema.parse(body)).toThrow("URL contains invalid characters");
  });

  it("should accept URLs with port numbers", () => {
    const body = {
      url: "https://example.com:8080/webhook?param=value",
      events: ["test.event"],
    };
    expect(() => createSubscriptionSchema.parse(body)).not.toThrow();
  });

  it("should reject invalid protocol", () => {
    const body = {
      url: "not-a-valid-url",
      events: ["test.event"],
    };
    expect(() => createSubscriptionSchema.parse(body)).toThrow();
  });
});
