// LLM provider layer: Grok API (xAI) first, local Ollama as fallback.
// Embeddings stay local (bge-m3 via Ollama) — see ollama.ts.
const XAI_BASE = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
export const GROK_MODEL = process.env.GROK_MODEL ?? "grok-4";
const OLLAMA = process.env.OLLAMA_HOST ?? "http://ollama:11434";
const OLLAMA_MODEL = process.env.LLM_MODEL ?? "qwen3:8b";

export function llmInfo() {
  const grok = !!process.env.XAI_API_KEY;
  return { provider: grok ? "grok" : "ollama", model: grok ? GROK_MODEL : OLLAMA_MODEL };
}

async function grokJson<T>(prompt: string): Promise<T> {
  const r = await fetch(`${XAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json",
               Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: JSON.stringify({
      model: GROK_MODEL, temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Reply with a single valid JSON object and nothing else." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) throw new Error(`grok ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return JSON.parse((await r.json() as any).choices[0].message.content) as T;
}

async function ollamaJson<T>(prompt: string): Promise<T> {
  const r = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, format: "json", stream: false,
                           options: { temperature: 0.2 } }),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}`);
  return JSON.parse((await r.json() as any).response) as T;
}

export async function llmJson<T = any>(prompt: string): Promise<T> {
  if (process.env.XAI_API_KEY) {
    try { return await grokJson<T>(prompt); }
    catch (e) {
      // Grok down/quota → local fallback keeps the OS running
      try { return await ollamaJson<T>(prompt); } catch { throw e; }
    }
  }
  return ollamaJson<T>(prompt);
}
