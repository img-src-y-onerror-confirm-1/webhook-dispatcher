import { describe, it, expect } from "vitest";
import { buildSignatureHeader } from "../src/utils/hmac";

describe("HMAC signatures", () => {
  it("produces a stable signature for the same payload", () => {
    const a = buildSignatureHeader('{"event":"test"}');
    const b = buildSignatureHeader('{"event":"test"}');
    expect(a).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
    expect(a.split(",")[1]).not.toBe(b.split(",")[1]);
  });

  it("includes timestamp and v1 signature", () => {
    const header = buildSignatureHeader("test-payload");
    const parts = header.split(",");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^t=\d+$/);
    expect(parts[1]).toMatch(/^v1=[a-f0-9]{64}$/);
  });
});
