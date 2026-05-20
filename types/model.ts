export type ModelStatus = "ACTIVE" | "IDLE" | "OFFLINE" | "ERROR" | "UPDATING";
export type ModelType = "API" | "LOCAL";

export type Model = {
  id: string;
  name: string;
  provider: string;
  version: string;
  status: ModelStatus;
  type: ModelType;
  usage: number;
  connectedAgents: number;
  contextWindow: string;
  quota: string;
  addedOn: string;
  description: string;
  apiEndpoint: string;
  localPath: string;
};
