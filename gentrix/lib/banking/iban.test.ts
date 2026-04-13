import { describe, expect, it } from "vitest";
import { isNlIban, isValidIban, normalizeIban } from "./iban";

describe("iban", () => {
  it("normalizes spaces", () => {
    expect(normalizeIban(" nl 91 abna 0417 1643 00 ")).toBe("NL91ABNA0417164300");
  });

  it("validates known test IBAN", () => {
    expect(isValidIban("NL91ABNA0417164300")).toBe(true);
    expect(isNlIban("NL91ABNA0417164300")).toBe(true);
  });

  it("rejects bad checksum", () => {
    expect(isValidIban("NL92ABNA0417164300")).toBe(false);
  });

  it("rejects garbage", () => {
    expect(isValidIban("NL91ABNA0417164301")).toBe(false);
    expect(isValidIban("")).toBe(false);
  });
});
