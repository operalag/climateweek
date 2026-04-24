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
  /** If provided, a top-level JSON array from the model is wrapped as { [arrayKey]: [...] }. */
  arrayKey?: string;
}): Promise<T> {
  const model = args.model ?? "claude-sonnet-4-6";
  const strictSystem =
    args.system +
    "\n\nCRITICAL: Respond with VALID JSON ONLY. Never prose. Never 'I need more context'. If unsure, return an empty array for list fields. No markdown, no fencing, no comments.";

  const ask = async (attempt: number) => {
    const res = await client().messages.create({
      model,
      max_tokens: args.maxTokens ?? 2000,
      system: attempt === 0 ? strictSystem : strictSystem + "\nPrevious reply was not valid JSON. Return the JSON object now.",
      messages: [{ role: "user", content: args.user }],
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  };

  const extractJson = (text: string): unknown => {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // find first { ... } or [ ... ] block
      const objMatch = cleaned.match(/[{[][\s\S]*[}\]]/);
      if (objMatch) {
        try {
          return JSON.parse(objMatch[0]);
        } catch {
          /* fall through */
        }
      }
      throw new Error("not json");
    }
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await ask(attempt);
      let parsed = extractJson(text);
      if (args.arrayKey && Array.isArray(parsed)) {
        parsed = { [args.arrayKey]: parsed };
      }
      return args.schema.parse(parsed);
    } catch (err) {
      if (attempt === 1) throw err;
      // else retry
    }
  }
  throw new Error("claudeStructured: unreachable");
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
