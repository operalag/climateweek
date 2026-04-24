/**
 * Perplexity Sonar — agentic research with sources.
 * Docs: https://docs.perplexity.ai/
 */

const BASE = "https://api.perplexity.ai/chat/completions";

function key() {
  const k = process.env.PERPLEXITY_API_KEY;
  if (!k) throw new Error("PERPLEXITY_API_KEY missing");
  return k;
}

export interface PerplexityAnswer {
  content: string;
  citations: string[];
  model: string;
}

export async function perplexityAsk(
  prompt: string,
  opts: { model?: string; system?: string } = {},
): Promise<PerplexityAnswer> {
  const model = opts.model ?? "sonar";
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`perplexity ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as {
    choices: { message: { content: string } }[];
    citations?: string[];
    model: string;
  };
  return {
    content: body.choices?.[0]?.message?.content ?? "",
    citations: body.citations ?? [],
    model: body.model,
  };
}
