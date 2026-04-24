import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

function client() {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error("ANTHROPIC_API_KEY missing");
  return new Anthropic({ apiKey: k });
}

/** One-shot structured JSON generation with retries + zod validation. */
export async function claudeStructured<T>(args: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const model = args.model ?? "claude-sonnet-4-6";
  const res = await client().messages.create({
    model,
    max_tokens: args.maxTokens ?? 2000,
    system:
      args.system +
      "\n\nYou MUST respond with valid JSON only. No prose, no markdown, no fencing.",
    messages: [{ role: "user", content: args.user }],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // strip fences if the model adds them anyway
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  return args.schema.parse(parsed);
}

/** Simple text prompt. */
export async function claudeText(args: {
  system?: string;
  user: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const model = args.model ?? "claude-sonnet-4-6";
  const res = await client().messages.create({
    model,
    max_tokens: args.maxTokens ?? 1500,
    ...(args.system ? { system: args.system } : {}),
    messages: [{ role: "user", content: args.user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
