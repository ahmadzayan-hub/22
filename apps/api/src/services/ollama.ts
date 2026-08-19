// Local sidecars: embeddings (bge-m3, 1024-dim — must match schema) + whisper ASR.
// Chat/JSON generation lives in llm.ts (Grok API first, Ollama fallback).
const OLLAMA = process.env.OLLAMA_HOST ?? "http://ollama:11434";
export const EMBED_MODEL = process.env.EMBED_MODEL ?? "bge-m3";

export { llmJson } from "./llm.js";

export async function embed(text: string): Promise<number[]> {
  const r = await fetch(`${OLLAMA}/api/embed`, { method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: [text.slice(0, 8000)] }) });
  if (!r.ok) throw new Error(`embed ${r.status}`);
  return ((await r.json() as any).embeddings as number[][])[0];
}

export async function transcribe(buf: Buffer, name: string): Promise<string> {
  const url = process.env.WHISPER_URL ?? "http://whisper:8000/v1/audio/transcriptions";
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)]), name);
  fd.append("model", "Systran/faster-whisper-small");
  const r = await fetch(url, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`asr ${r.status}`);
  return ((await r.json() as any).text as string).trim();
}
