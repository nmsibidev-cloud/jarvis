import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { fetchWithTimeout, getErrorMessage } from "@/lib/server/http";

export type ProviderHealth = {
  provider: "openai" | "anthropic" | "gemini" | "ollama" | "agent-gateway" | "openclaw";
  configured: boolean;
  connected: boolean;
  endpoint?: string;
  message: string;
};

export type ProviderChatRequest = {
  prompt: string;
  modelName: string;
  systemPrompt: string;
};

export type ProviderChatResult = {
  content: string;
  provider: ProviderHealth["provider"];
  live: boolean;
};

const execFileAsync = promisify(execFile);

const ollamaBaseUrl = () => process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const gatewayBaseUrl = () => process.env.AGENT_GATEWAY_URL ?? "http://127.0.0.1:1878";

export async function checkOllamaHealth(): Promise<ProviderHealth> {
  const endpoint = ollamaBaseUrl();
  try {
    const response = await fetchWithTimeout(`${endpoint}/api/tags`, { cache: "no-store" }, 2500);
    return { provider: "ollama", configured: true, connected: response.ok, endpoint, message: response.ok ? "Ollama reachable" : `Ollama returned ${response.status}` };
  } catch (error) {
    return { provider: "ollama", configured: true, connected: false, endpoint, message: getErrorMessage(error) };
  }
}

export async function checkAgentGatewayHealth(): Promise<ProviderHealth> {
  const endpoint = gatewayBaseUrl();
  try {
    const response = await fetchWithTimeout(`${endpoint}/health`, { cache: "no-store" }, 2500);
    return { provider: "agent-gateway", configured: true, connected: response.ok, endpoint, message: response.ok ? "Agent Gateway reachable" : `Gateway returned ${response.status}` };
  } catch (error) {
    return { provider: "agent-gateway", configured: true, connected: false, endpoint, message: getErrorMessage(error) };
  }
}

export async function checkOpenAiHealth(): Promise<ProviderHealth> {
  if (!process.env.OPENAI_API_KEY) return { provider: "openai", configured: false, connected: false, message: "OPENAI_API_KEY is not configured" };
  try {
    const response = await fetchWithTimeout("https://api.openai.com/v1/models", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });
    return { provider: "openai", configured: true, connected: response.ok, endpoint: "https://api.openai.com/v1", message: response.ok ? "OpenAI reachable" : `OpenAI returned ${response.status}` };
  } catch (error) {
    return { provider: "openai", configured: true, connected: false, endpoint: "https://api.openai.com/v1", message: getErrorMessage(error) };
  }
}

export async function checkAnthropicHealth(): Promise<ProviderHealth> {
  if (!process.env.ANTHROPIC_API_KEY) return { provider: "anthropic", configured: false, connected: false, message: "ANTHROPIC_API_KEY is not configured" };
  return { provider: "anthropic", configured: true, connected: true, endpoint: "https://api.anthropic.com/v1", message: "Anthropic key configured; chat endpoint will be used on demand" };
}

export async function checkGeminiHealth(): Promise<ProviderHealth> {
  if (!process.env.GEMINI_API_KEY) return { provider: "gemini", configured: false, connected: false, message: "GEMINI_API_KEY is not configured" };
  try {
    const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`, { cache: "no-store" });
    return { provider: "gemini", configured: true, connected: response.ok, endpoint: "https://generativelanguage.googleapis.com/v1beta", message: response.ok ? "Gemini reachable" : `Gemini returned ${response.status}` };
  } catch (error) {
    return { provider: "gemini", configured: true, connected: false, endpoint: "https://generativelanguage.googleapis.com/v1beta", message: getErrorMessage(error) };
  }
}

export async function callOpenClawInfer({ prompt, modelName, systemPrompt }: ProviderChatRequest): Promise<ProviderChatResult> {
  const fullPrompt = `${systemPrompt}\n\nUser request:\n${prompt}`;
  const { stdout, stderr } = await execFileAsync("openclaw", ["infer", "model", "run", "--model", modelName, "--prompt", fullPrompt, "--json"], {
    timeout: 120000,
    maxBuffer: 1024 * 1024 * 2
  });
  const parsed = JSON.parse(stdout) as { outputs?: Array<{ text?: string }> };
  const content = parsed.outputs?.map((output) => output.text).filter(Boolean).join("\n").trim() ?? "";
  if (!content) throw new Error(stderr.trim() || `No text output returned from OpenClaw infer for ${modelName}`);
  return { content, provider: "openclaw", live: true };
}

export async function callOllamaChat({ prompt, modelName, systemPrompt }: ProviderChatRequest): Promise<ProviderChatResult> {
  const model = process.env.OLLAMA_MODEL || modelName.replace(/^ollama\//, "") || "llama3.1";
  const response = await fetchWithTimeout(`${ollamaBaseUrl()}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] })
  }, 60000);
  if (!response.ok) throw new Error(`Ollama chat returned ${response.status}`);
  const data = await response.json() as { message?: { content?: string }; response?: string };
  return { content: data.message?.content ?? data.response ?? "", provider: "ollama", live: true };
}

export async function callOpenAiChat({ prompt, modelName, systemPrompt }: ProviderChatRequest): Promise<ProviderChatResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || modelName || "gpt-4o", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] })
  }, 20000);
  if (!response.ok) throw new Error(`OpenAI chat returned ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { content: data.choices?.[0]?.message?.content ?? "", provider: "openai", live: true };
}

export async function callAnthropicChat({ prompt, modelName, systemPrompt }: ProviderChatRequest): Promise<ProviderChatResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || modelName || "claude-3-5-sonnet-latest", max_tokens: 1200, system: systemPrompt, messages: [{ role: "user", content: prompt }] })
  }, 20000);
  if (!response.ok) throw new Error(`Anthropic chat returned ${response.status}`);
  const data = await response.json() as { content?: Array<{ text?: string }> };
  return { content: data.content?.map((item) => item.text).filter(Boolean).join("\n") ?? "", provider: "anthropic", live: true };
}

export async function callGeminiChat({ prompt, modelName, systemPrompt }: ProviderChatRequest): Promise<ProviderChatResult> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
  const model = process.env.GEMINI_MODEL || modelName || "gemini-1.5-pro";
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: "user", parts: [{ text: prompt }] }] })
  }, 20000);
  if (!response.ok) throw new Error(`Gemini chat returned ${response.status}`);
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return { content: data.candidates?.[0]?.content?.parts?.map((item) => item.text).filter(Boolean).join("\n") ?? "", provider: "gemini", live: true };
}
