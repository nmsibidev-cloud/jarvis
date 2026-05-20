import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

import { Agent } from "@/types/agent";

const execFileAsync = promisify(execFile);

type OpenClawStatus = {
  gatewayService?: {
    runtimeShort?: string;
    runtime?: { status?: string; pid?: number };
    layout?: { packageVersion?: string; execStart?: string };
  };
  nodeService?: {
    runtimeShort?: string;
    runtime?: { status?: string; detail?: string };
  };
  agents?: {
    agents?: Array<{
      id: string;
      workspaceDir?: string;
      sessionsCount?: number;
      lastUpdatedAt?: number;
      lastActiveAgeMs?: number;
      bootstrapPending?: boolean;
    }>;
  };
};

type OpenClawAgentListItem = {
  id: string;
  identityName?: string;
  identityEmoji?: string;
  workspace?: string;
  model?: string;
  bindings?: number;
  isDefault?: boolean;
};

function initials(value: string) {
  return value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "AG";
}

function statusFromRuntime(status?: string): Agent["status"] {
  if (!status) return "ERROR";
  if (/running|online|loaded/i.test(status)) return "ONLINE";
  if (/starting|pending|busy/i.test(status)) return "BUSY";
  if (/unknown|not loaded|offline|error|failed/i.test(status)) return "ERROR";
  return "IDLE";
}

function ageLabel(ageMs?: number) {
  if (ageMs == null) return "unknown";
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function hostLoadPercent() {
  const cores = Math.max(1, os.cpus().length);
  return Math.min(100, Math.round((os.loadavg()[0] / cores) * 100));
}

function hostRamPercent() {
  return Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
}

async function readOpenClawStatus(): Promise<OpenClawStatus> {
  const { stdout } = await execFileAsync("openclaw", ["status", "--json"], { timeout: 8000, maxBuffer: 1024 * 1024 * 2 });
  return JSON.parse(stdout) as OpenClawStatus;
}

async function readOpenClawAgents(): Promise<OpenClawAgentListItem[]> {
  try {
    const { stdout } = await execFileAsync("openclaw", ["agents", "list", "--json"], { timeout: 8000, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout) as unknown;
    return Array.isArray(parsed) ? parsed as OpenClawAgentListItem[] : [];
  } catch {
    return [];
  }
}

export async function getLiveAgents(): Promise<Agent[]> {
  const [status, configuredAgents] = await Promise.all([readOpenClawStatus(), readOpenClawAgents()]);
  const cpuUsage = hostLoadPercent();
  const ramUsage = hostRamPercent();
  const createdAt = new Date().toISOString();

  const statusAgents = new Map((status.agents?.agents ?? []).map((agent) => [agent.id, agent]));

  const openClawAgents: Agent[] = configuredAgents.length
    ? configuredAgents.map((agent) => {
      const runtime = statusAgents.get(agent.id);
      return {
        id: `openclaw-${agent.id}`,
        name: agent.identityName ? `${agent.identityName}${agent.identityEmoji ? ` ${agent.identityEmoji}` : ""}` : `OpenClaw ${agent.id}`,
        role: agent.isDefault ? "Default Local Agent" : "Local Agent",
        initials: initials(agent.identityName ?? agent.id),
        status: runtime?.bootstrapPending ? "BUSY" : runtime ? "ONLINE" : "IDLE",
        currentTask: `${runtime?.sessionsCount ?? agent.bindings ?? 0} sessions in ${agent.workspace ?? runtime?.workspaceDir ?? "workspace"}`,
        cpuUsage,
        ramUsage,
        assignedModel: agent.model ?? "Configured by OpenClaw runtime",
        lastActive: ageLabel(runtime?.lastActiveAgeMs),
        permissions: ["workspace_read", "session_orchestration", "tool_execution_with_policy"],
        brain: "OpenClaw Workspace Memory",
        createdAt: runtime?.lastUpdatedAt ? new Date(runtime.lastUpdatedAt).toISOString() : createdAt
      };
    })
    : (status.agents?.agents ?? []).map((agent) => ({
    id: `openclaw-${agent.id}`,
    name: `OpenClaw ${agent.id}`,
    role: "Local Agent",
    initials: initials(agent.id),
    status: agent.bootstrapPending ? "BUSY" : "ONLINE",
    currentTask: `${agent.sessionsCount ?? 0} sessions in ${agent.workspaceDir ?? "workspace"}`,
    cpuUsage,
    ramUsage,
    assignedModel: "Configured by OpenClaw runtime",
    lastActive: ageLabel(agent.lastActiveAgeMs),
    permissions: ["workspace_read", "session_orchestration", "tool_execution_with_policy"],
    brain: "OpenClaw Workspace Memory",
    createdAt: agent.lastUpdatedAt ? new Date(agent.lastUpdatedAt).toISOString() : createdAt
  }));

  const gateway = status.gatewayService;
  const gatewayAgent: Agent = {
    id: "openclaw-gateway",
    name: "OpenClaw Gateway",
    role: "System Gateway",
    initials: "GW",
    status: statusFromRuntime(gateway?.runtime?.status),
    currentTask: gateway?.runtimeShort ?? "Gateway service status unavailable",
    cpuUsage,
    ramUsage,
    assignedModel: gateway?.layout?.packageVersion ? `OpenClaw ${gateway.layout.packageVersion}` : "OpenClaw Gateway",
    lastActive: "live",
    permissions: ["api_routing", "session_delivery", "cron_events"],
    brain: "System Runtime",
    createdAt
  };

  const node = status.nodeService;
  const nodeAgent: Agent = {
    id: "openclaw-node-service",
    name: "OpenClaw Node Service",
    role: "Remote Node",
    initials: "ND",
    status: statusFromRuntime(node?.runtime?.status),
    currentTask: node?.runtimeShort ?? node?.runtime?.detail ?? "Node service not configured on this Mac",
    cpuUsage: 0,
    ramUsage: 0,
    assignedModel: "Upcoming remote node runtime",
    lastActive: "not loaded",
    permissions: ["remote_pairing_upcoming"],
    brain: "Upcoming",
    createdAt
  };

  return [gatewayAgent, ...openClawAgents, nodeAgent];
}
