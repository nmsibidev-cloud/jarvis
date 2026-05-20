import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { checkAnthropicHealth, checkGeminiHealth, checkOllamaHealth, checkOpenAiHealth } from "@/lib/server/provider-clients";
import { Model } from "@/types/model";

const execFileAsync = promisify(execFile);

type OpenClawModel = {
  key: string;
  name: string;
  input?: string;
  contextWindow?: number;
  local?: boolean;
  available?: boolean;
  tags?: string[];
  missing?: boolean;
};

type OllamaModel = {
  name: string;
  id: string;
  size: string;
  modified: string;
};

function providerFromKey(key: string) {
  const provider = key.split("/")[0] ?? "unknown";
  if (provider === "ollama") return "Ollama";
  if (provider === "openai-codex") return "OpenAI Codex";
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "gemini" || provider === "google") return "Google";
  if (provider === "qwen") return "Qwen";
  return provider.replace(/(^|-)([a-z])/g, (_match, sep: string, char: string) => `${sep ? " " : ""}${char.toUpperCase()}`);
}

function parseOllamaList(output: string): OllamaModel[] {
  return output
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+(.+?)\s{2,}(.+)$/);
      return match ? { name: match[1], id: match[2], size: match[3].trim(), modified: match[4].trim() } : null;
    })
    .filter((item): item is OllamaModel => Boolean(item));
}

async function listOpenClawModels() {
  try {
    const { stdout } = await execFileAsync("openclaw", ["models", "list", "--json"], { timeout: 8000, maxBuffer: 1024 * 1024 * 2 });
    const parsed = JSON.parse(stdout) as { models?: OpenClawModel[] };
    return Array.isArray(parsed.models) ? parsed.models : [];
  } catch {
    return [];
  }
}

async function listOllamaModels() {
  try {
    const { stdout } = await execFileAsync("ollama", ["list"], { timeout: 5000, maxBuffer: 1024 * 1024 });
    return parseOllamaList(stdout);
  } catch {
    return [];
  }
}

function openClawModelToModel(model: OpenClawModel): Model {
  const provider = providerFromKey(model.key);
  return {
    id: model.key,
    name: model.name,
    provider,
    version: model.key,
    type: model.local || provider === "Ollama" ? "LOCAL" : "API",
    status: model.available && !model.missing ? "ACTIVE" : model.missing ? "OFFLINE" : "IDLE",
    usage: model.tags?.includes("default") ? 10 : 0,
    connectedAgents: model.tags?.includes("default") ? 1 : 0,
    contextWindow: model.contextWindow ? `${model.contextWindow.toLocaleString()} tokens` : "Provider dependent",
    quota: model.tags?.join(", ") || "Configured in OpenClaw",
    addedOn: "OpenClaw model config",
    description: `OpenClaw ${model.local ? "local" : "provider"} model (${model.input ?? "text"}).`,
    apiEndpoint: provider === "Ollama" ? "http://127.0.0.1:11434" : "OpenClaw model provider",
    localPath: model.local || provider === "Ollama" ? "OpenClaw/Ollama managed model" : ""
  };
}

function ollamaModelToModel(model: OllamaModel, ollamaConnected: boolean): Model {
  const baseName = model.name.replace(/:latest$/, "");
  return {
    id: `ollama/${baseName}`,
    name: baseName,
    provider: "Ollama",
    version: model.id,
    type: "LOCAL",
    status: ollamaConnected ? "ACTIVE" : "OFFLINE",
    usage: 0,
    connectedAgents: 0,
    contextWindow: "Detected locally",
    quota: model.size,
    addedOn: model.modified,
    description: `Local Ollama model detected on this Mac (${model.size}).`,
    apiEndpoint: "http://127.0.0.1:11434",
    localPath: "Ollama managed model store"
  };
}

function apiModel(params: {
  id: string;
  name: string;
  provider: string;
  configured: boolean;
  connected: boolean;
  endpoint: string;
  message: string;
  contextWindow: string;
}): Model {
  return {
    id: params.id,
    name: params.name,
    provider: params.provider,
    version: params.configured ? "configured" : "not configured",
    type: "API",
    status: params.connected ? "ACTIVE" : params.configured ? "OFFLINE" : "IDLE",
    usage: params.connected ? 5 : 0,
    connectedAgents: 0,
    contextWindow: params.contextWindow,
    quota: params.configured ? "Live check" : "Upcoming/config needed",
    addedOn: "Live provider check",
    description: params.message,
    apiEndpoint: params.endpoint,
    localPath: ""
  };
}

function uniqueModels(models: Model[]) {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = `${model.provider}:${model.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getLiveModels(): Promise<Model[]> {
  const [openai, anthropic, gemini, ollama, ollamaModels, openClawModels] = await Promise.all([
    checkOpenAiHealth(),
    checkAnthropicHealth(),
    checkGeminiHealth(),
    checkOllamaHealth(),
    listOllamaModels(),
    listOpenClawModels()
  ]);

  const configuredModels = openClawModels.map(openClawModelToModel);
  const localModels = ollamaModels.map((model) => ollamaModelToModel(model, ollama.connected));

  return uniqueModels([
    ...configuredModels,
    ...localModels,
    apiModel({
      id: "provider-openai",
      name: process.env.OPENAI_MODEL || "OpenAI API",
      provider: "OpenAI",
      configured: openai.configured,
      connected: openai.connected,
      endpoint: openai.endpoint ?? "https://api.openai.com/v1",
      message: openai.message,
      contextWindow: "Provider dependent"
    }),
    apiModel({
      id: "provider-anthropic",
      name: process.env.ANTHROPIC_MODEL || "Anthropic API",
      provider: "Anthropic",
      configured: anthropic.configured,
      connected: anthropic.connected,
      endpoint: anthropic.endpoint ?? "https://api.anthropic.com/v1",
      message: anthropic.message,
      contextWindow: "Provider dependent"
    }),
    apiModel({
      id: "provider-gemini",
      name: process.env.GEMINI_MODEL || "Gemini API",
      provider: "Google",
      configured: gemini.configured,
      connected: gemini.connected,
      endpoint: gemini.endpoint ?? "https://generativelanguage.googleapis.com/v1beta",
      message: gemini.message,
      contextWindow: "Provider dependent"
    })
  ]);
}
