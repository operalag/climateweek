import { GoogleGenerativeAI } from "@google/generative-ai";

function client() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY missing");
  return new GoogleGenerativeAI(k);
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
