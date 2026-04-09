import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { MessageDeltaUsage } from "@anthropic-ai/sdk/resources/messages/messages";

export type ClaudeTextStreamEvent =
  | { type: "delta"; text: string }
  | { type: "end"; usage: MessageDeltaUsage | null; stop_reason: string | null };

export async function* streamClaudeMessageText(
  client: Anthropic,
  input: {
    model: string;
    max_tokens: number;
    system?: string;
    userContent: string | ContentBlockParam[];
  },
): AsyncGenerator<ClaudeTextStreamEvent> {
  const userContent: string | ContentBlockParam[] =
    typeof input.userContent === "string"
      ? [{ type: "text" as const, text: input.userContent }]
      : input.userContent;

  const stream = await client.messages.create({
    model: input.model,
    max_tokens: input.max_tokens,
    stream: true,
    ...(input.system ? { system: input.system } : {}),
    messages: [{ role: "user", content: userContent }],
  });

  let usage: MessageDeltaUsage | null = null;
  let stop_reason: string | null = null;

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "delta", text: event.delta.text };
    } else if (event.type === "message_delta") {
      usage = event.usage;
      stop_reason = event.delta.stop_reason;
    }
  }

  yield { type: "end", usage, stop_reason };
}
