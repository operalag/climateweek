import { GoogleGenerativeAI } from "@google/generative-ai";

function apiKey() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY missing");
  return k;
}

function client() {
  return new GoogleGenerativeAI(apiKey());
}

/** Fast cheap extraction — fallback for bulk jobs. */
export async function geminiText(
  prompt: string,
  opts: { model?: string; system?: string } = {},
): Promise<string> {
  const model = client().getGenerativeModel({
    model: opts.model ?? "gemini-2.5-flash",
    ...(opts.system ? { systemInstruction: opts.system } : {}),
  });
  const res = await model.generateContent(prompt);
  return res.response.text();
}

/**
 * Gemini with Google Search grounding — returns the raw text plus any
 * citations. The SDK's tool-config surface varies by version, so we call
 * the REST endpoint directly and keep this tiny.
 */
export async function geminiGrounded(
  prompt: string,
  opts: { model?: string } = {},
): Promise<{ text: string; citations: string[] }> {
  const model = opts.model ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey()}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] };
    }[];
  };
  const cand = body.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const citations =
    cand?.groundingMetadata?.groundingChunks
      ?.map((c) => c.web?.uri)
      .filter((u): u is string => !!u) ?? [];
  return { text, citations };
}
