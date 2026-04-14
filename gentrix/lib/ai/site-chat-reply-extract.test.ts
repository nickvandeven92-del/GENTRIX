import { describe, expect, it } from "vitest";
import { extractPartialReplyFromStreamingSiteChatJson } from "@/lib/ai/site-chat-reply-extract";

describe("extractPartialReplyFromStreamingSiteChatJson", () => {
  it("returns empty until reply key appears", () => {
    expect(extractPartialReplyFromStreamingSiteChatJson('{"')).toBe("");
    expect(extractPartialReplyFromStreamingSiteChatJson('{"rep')).toBe("");
  });

  it("extracts prefix of reply string", () => {
    const buf = `{"reply":"Hallo, ik pas `;
    expect(extractPartialReplyFromStreamingSiteChatJson(buf)).toBe("Hallo, ik pas ");
  });

  it("handles escapes in partial buffer", () => {
    const buf = `{"reply":"Regel 1\\nRegel `;
    expect(extractPartialReplyFromStreamingSiteChatJson(buf)).toBe("Regel 1\nRegel ");
  });

  it("stops at closing quote", () => {
    const buf = `{"reply":"Klaar.","sectionUpdates"`;
    expect(extractPartialReplyFromStreamingSiteChatJson(buf)).toBe("Klaar.");
  });
});
