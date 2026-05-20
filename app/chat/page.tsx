"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { EllipsisVertical, Eraser, FilePlus2, Plus, Share2, Users2 } from "lucide-react";

import { AgentSelectorPanel } from "@/components/chat/agent-selector-panel";
import { ChangeModelModal } from "@/components/chat/change-model-modal";
import { ChatWindow } from "@/components/chat/chat-window";
import { ClearChatModal } from "@/components/chat/clear-chat-modal";
import { ExportChatModal } from "@/components/chat/export-chat-modal";
import { ModelSelectionPanel } from "@/components/chat/model-selection-panel";
import { NewChatModal, NewChatValues } from "@/components/chat/new-chat-modal";
import { QuickActionCard } from "@/components/chat/quick-action-card";
import { SaveAsNoteModal } from "@/components/chat/save-as-note-modal";
import { SessionDetailsPanel } from "@/components/chat/session-details-panel";
import { ShareChatModal } from "@/components/chat/share-chat-modal";
import { SidebarPanel } from "@/components/chat/sidebar-panel";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ActionButtonGroup } from "@/components/shared/action-button-group";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { ToastItem, ToastStack } from "@/components/ui/toast-stack";
import { ResponsiveDrawer } from "@/components/ui/responsive-drawer";
import { chatMockData } from "@/lib/data/chat";
import { systemStats } from "@/lib/data/system";
import { useChatStore } from "@/lib/store/chat-store";

type ModalState = null | "new_chat" | "clear_chat" | "export_chat" | "share_chat" | "save_note" | "change_model";

const quickActions = [
  { key: "clear", title: "Clear Chat", description: "Reset active conversation", icon: Eraser },
  { key: "export", title: "Export Chat", description: "Download session transcript", icon: FilePlus2 },
  { key: "share", title: "Share Chat", description: "Share with internal teams", icon: Share2 },
  { key: "note", title: "Save as Note", description: "Send to Obsidian knowledge", icon: FilePlus2 }
] as const;

export default function ChatPage() {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [searchValue, setSearchValue] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileAgentsOpen, setMobileAgentsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const agents = useChatStore((state) => state.agents);
  const models = useChatStore((state) => state.models);
  const sessions = useChatStore((state) => state.sessions);
  const messages = useChatStore((state) => state.messages);
  const selectedAgentId = useChatStore((state) => state.selectedAgentId);
  const selectedSessionId = useChatStore((state) => state.selectedSessionId);
  const draftMessage = useChatStore((state) => state.draftMessage);
  const typingSessionIds = useChatStore((state) => state.typingSessionIds);
  const setDraftMessage = useChatStore((state) => state.setDraftMessage);
  const selectAgent = useChatStore((state) => state.selectAgent);
  const selectSession = useChatStore((state) => state.selectSession);
  const createSession = useChatStore((state) => state.createSession);
  const sendUserMessage = useChatStore((state) => state.sendUserMessage);
  const sendAgentMessage = useChatStore((state) => state.sendAgentMessage);
  const clearSession = useChatStore((state) => state.clearSession);
  const switchModel = useChatStore((state) => state.switchModel);
  const setTyping = useChatStore((state) => state.setTyping);
  const hydrate = useChatStore((state) => state.hydrate);

  const bootstrapQuery = useQuery({
    queryKey: ["chat", "bootstrap"],
    queryFn: async () => {
      const response = await fetch("/api/chat/bootstrap", { cache: "no-store" });
      if (!response.ok) return chatMockData;
      return response.json();
    }
  });

  useEffect(() => {
    if (bootstrapQuery.data) hydrate(bootstrapQuery.data);
  }, [bootstrapQuery.data, hydrate]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      window.addEventListener("mousedown", onMouseDown);
    }
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  const pushToast = useCallback((payload: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, ...payload }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const filteredAgents = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) => [agent.name, agent.role, agent.description, agent.status].join(" ").toLowerCase().includes(query));
  }, [agents, searchValue]);

  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId), [agents, selectedAgentId]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedSessionId), [selectedSessionId, sessions]);
  const selectedModel = useMemo(
    () => models.find((model) => model.id === (selectedSession?.modelId ?? models[0]?.id)),
    [models, selectedSession?.modelId]
  );
  const sessionMessages = useMemo(() => messages.filter((message) => message.sessionId === selectedSession?.id), [messages, selectedSession?.id]);
  const sessionsForAgent = useMemo(() => sessions.filter((session) => session.agentId === selectedAgentId), [selectedAgentId, sessions]);
  const isTyping = useMemo(() => typingSessionIds.includes(selectedSession?.id ?? ""), [selectedSession?.id, typingSessionIds]);
  const chatDisabledReason = useMemo(() => {
    if (!agents.length) return "No live agents were detected. Start or connect an agent to begin chatting.";
    if (!models.length) return "No live models were detected. Connect Ollama or configure a provider model to begin chatting.";
    if (!selectedAgent) return "Select an agent to begin chatting.";
    if (selectedAgent.status === "OFFLINE") return `${selectedAgent.name} is offline. Select an online or idle agent to chat.`;
    if (!selectedModel) return "Select a model to begin chatting.";
    if (selectedModel.status === "OFFLINE" || selectedModel.status === "ERROR") return `${selectedModel.name} is unavailable. Select an active or idle model to chat.`;
    return null;
  }, [agents.length, models.length, selectedAgent, selectedModel]);
  const isChatDisabled = Boolean(chatDisabledReason);

  const openModal = (modal: ModalState) => setActiveModal(modal);
  const closeModal = () => setActiveModal(null);

  const handleSendMessage = () => {
    const prompt = draftMessage.trim();
    if (!prompt) return;
    if (isChatDisabled) {
      pushToast({
        title: "Chat unavailable",
        description: chatDisabledReason ?? "Select an available agent and model first.",
        tone: "warning"
      });
      return;
    }
    const sessionId = sendUserMessage(prompt);
    if (!sessionId) return;

    const agentId = selectedAgent?.id ?? selectedAgentId;
    const modelId = selectedSession?.modelId ?? models[0]?.id ?? "";

    setTyping(sessionId, true);
    window.setTimeout(() => {
      fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, modelId, prompt, sessionId, sessionTitle: selectedSession?.title })
      })
        .then((response) => {
          if (!response.ok) throw new Error("Chat backend request failed");
          return response.json();
        })
        .then((response: { agentMessage?: { content?: string } }) => sendAgentMessage(sessionId, response.agentMessage?.content ?? "No response returned.", "markdown"))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Unknown chat backend error";
          sendAgentMessage(sessionId, `Backend chat request failed: ${message}`, "markdown");
        })
        .finally(() => setTyping(sessionId, false));
    }, 900);
  };

  const handleSelectAgent = (agentId: string) => {
    selectAgent(agentId);
  };

  const handleCreateChat = (values: NewChatValues) => {
    const sessionId = createSession(values);
    if (!sessionId) return;
    pushToast({
      title: "Chat session created",
      description: "New session is ready for your selected agent.",
      tone: "success"
    });
  };

  const handleClearChat = () => {
    if (!selectedSession) return;
    clearSession(selectedSession.id);
    pushToast({
      title: "Chat cleared",
      description: `${selectedSession.title} was reset.`,
      tone: "warning"
    });
    closeModal();
  };

  const handleSwitchModel = (modelId: string) => {
    if (!selectedSession) return;
    switchModel(selectedSession.id, modelId);
    pushToast({
      title: "Model switched",
      description: "Session model was updated successfully.",
      tone: "success"
    });
  };

  const handleQuickAction = (action: (typeof quickActions)[number]["key"]) => {
    if (action === "clear") return openModal("clear_chat");
    if (action === "export") return openModal("export_chat");
    if (action === "share") return openModal("share_chat");
    openModal("save_note");
  };

  if (bootstrapQuery.isLoading) {
    return (
      <DashboardLayout system={systemStats}>
        <LoadingState label="Loading chat communication hub..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout system={systemStats}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-4">
          <PageHeader
            actions={
              <ActionButtonGroup>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-500/55 bg-cyan-500/20 px-4 text-sm text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/30"
                  onClick={() => openModal("new_chat")}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  New Chat
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-500/35 bg-sky-950/45 px-4 text-sm text-cyan-200 transition hover:border-cyan-500/55 hover:bg-cyan-500/15"
                  onClick={() => openModal("clear_chat")}
                  type="button"
                >
                  <Eraser className="h-4 w-4" />
                  Clear Chat
                </button>
                <div className="relative" ref={menuRef}>
                  <button
                    aria-label="Open chat actions menu"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-500/35 bg-sky-950/45 text-cyan-200 transition hover:border-cyan-500/55 hover:bg-cyan-500/15"
                    onClick={() => setMenuOpen((current) => !current)}
                    type="button"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </button>
                  {menuOpen ? (
                    <div className="panel-base absolute right-0 top-12 z-20 min-w-[180px] rounded-lg border border-cyan-700/35 p-1.5">
                      <button
                        className="flex w-full rounded-md px-3 py-2 text-left text-sm text-cyan-100 transition hover:bg-cyan-500/15"
                        onClick={() => {
                          setMenuOpen(false);
                          openModal("export_chat");
                        }}
                        type="button"
                      >
                        Export Chat
                      </button>
                      <button
                        className="flex w-full rounded-md px-3 py-2 text-left text-sm text-cyan-100 transition hover:bg-cyan-500/15"
                        onClick={() => {
                          setMenuOpen(false);
                          openModal("share_chat");
                        }}
                        type="button"
                      >
                        Share Chat
                      </button>
                      <button
                        className="flex w-full rounded-md px-3 py-2 text-left text-sm text-cyan-100 transition hover:bg-cyan-500/15"
                        onClick={() => {
                          setMenuOpen(false);
                          openModal("save_note");
                        }}
                        type="button"
                      >
                        Save as Note
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-500/35 bg-sky-950/45 px-4 text-sm text-cyan-200 transition hover:border-cyan-500/55 hover:bg-cyan-500/15 lg:hidden"
                  onClick={() => setMobileAgentsOpen(true)}
                  type="button"
                >
                  <Users2 className="h-4 w-4" />
                  Agents
                </button>
              </ActionButtonGroup>
            }
            subtitle="Chat with your AI agents using the models you prefer."
            title="Chat"
          />

          <section className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
            <AgentSelectorPanel
              agents={filteredAgents}
              className="hidden lg:flex"
              onManageAgents={() => router.push("/agents")}
              onSearchChange={setSearchValue}
              onSelectAgent={handleSelectAgent}
              searchValue={searchValue}
              selectedAgentId={selectedAgentId}
            />

            <ChatWindow
              agent={selectedAgent}
              disabled={isChatDisabled}
              disabledReason={chatDisabledReason ?? undefined}
              draftMessage={draftMessage}
              messages={sessionMessages}
              modelOptions={models}
              onAttach={() =>
                pushToast({
                  title: "Attachment pipeline ready",
                  description: "File upload endpoint will be connected in backend integration.",
                  tone: "info"
                })
              }
              onDraftChange={setDraftMessage}
              onMention={() => pushToast({ title: "Mention picker coming soon", description: "Agent mention UX prepared for next iteration.", tone: "info" })}
              onOpenChangeModel={() => openModal("change_model")}
              onSelectModel={handleSwitchModel}
              onSendMessage={handleSendMessage}
              onTemplate={() => pushToast({ title: "Prompt templates", description: "Template registry will be linked to workflow presets.", tone: "info" })}
              selectedModelId={selectedSession?.modelId ?? models[0]?.id ?? ""}
              session={selectedSession}
              typing={isTyping}
            />
          </section>
        </main>

        <aside className="space-y-4">
          <SessionDetailsPanel
            agent={selectedAgent}
            model={selectedModel}
            onSelectSession={selectSession}
            onViewDetails={() =>
              pushToast({
                title: "Session details route ready",
                description: "Detailed chat session page is prepared for future expansion.",
                tone: "info"
              })
            }
            session={selectedSession}
            sessionsForAgent={sessionsForAgent}
          />

          <ModelSelectionPanel
            activeModelId={selectedSession?.modelId ?? models[0]?.id ?? ""}
            models={models}
            onManageModels={() => router.push("/models")}
            onSelectModel={handleSwitchModel}
          />

          <SidebarPanel title="Quick Actions">
            <div className="space-y-2.5">
              {quickActions.map((action) => (
                <QuickActionCard description={action.description} icon={action.icon} key={action.key} onClick={() => handleQuickAction(action.key)} title={action.title} />
              ))}
            </div>
          </SidebarPanel>
        </aside>
      </div>

      <NewChatModal agents={agents} models={models} onClose={closeModal} onCreate={handleCreateChat} open={activeModal === "new_chat"} />

      <ClearChatModal onClose={closeModal} onConfirm={handleClearChat} open={activeModal === "clear_chat"} sessionTitle={selectedSession?.title ?? "Current Session"} />

      <ExportChatModal
        onClose={closeModal}
        onExport={(values) =>
          pushToast({
            title: "Export queued",
            description: `Format ${values.format.toUpperCase()} export prepared with${values.includeMeta ? "" : "out"} metadata.`,
            tone: "success"
          })
        }
        open={activeModal === "export_chat"}
      />

      <ShareChatModal
        onClose={closeModal}
        onShare={(values) =>
          pushToast({
            title: "Chat shared",
            description: `Sent to ${values.recipientGroup.toUpperCase()} group.`,
            tone: "success"
          })
        }
        open={activeModal === "share_chat"}
      />

      <SaveAsNoteModal
        defaultTitle={selectedSession?.title ?? "New Chat Note"}
        onClose={closeModal}
        onSave={(values) =>
          pushToast({
            title: "Saved as note",
            description: `"${values.title}" routed to ${values.destination}.`,
            tone: "success"
          })
        }
        open={activeModal === "save_note"}
      />

      <ChangeModelModal
        currentModelId={selectedSession?.modelId ?? models[0]?.id ?? ""}
        models={models}
        onChangeModel={handleSwitchModel}
        onClose={closeModal}
        open={activeModal === "change_model"}
      />

      <ResponsiveDrawer
        description="Choose which AI agent to chat with."
        onClose={() => setMobileAgentsOpen(false)}
        open={mobileAgentsOpen}
        title="Select Agent"
      >
        <AgentSelectorPanel
          agents={filteredAgents}
          className="min-h-0 border-transparent bg-transparent shadow-none"
          onManageAgents={() => {
            setMobileAgentsOpen(false);
            router.push("/agents");
          }}
          onSearchChange={setSearchValue}
          onSelectAgent={(agentId) => {
            handleSelectAgent(agentId);
            setMobileAgentsOpen(false);
          }}
          searchValue={searchValue}
          selectedAgentId={selectedAgentId}
        />
      </ResponsiveDrawer>

      <ToastStack toasts={toasts} />
    </DashboardLayout>
  );
}
