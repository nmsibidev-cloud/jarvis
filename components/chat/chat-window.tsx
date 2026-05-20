import { AlertCircle } from "lucide-react";

import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { ChatAgent, ChatMessage as ChatMessageType, ChatModel, ChatSession } from "@/types/chat";

type ChatWindowProps = {
  agent: ChatAgent | undefined;
  session: ChatSession | undefined;
  messages: ChatMessageType[];
  typing: boolean;
  draftMessage: string;
  modelOptions: ChatModel[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  onOpenChangeModel: () => void;
  onDraftChange: (value: string) => void;
  onAttach: () => void;
  onMention: () => void;
  onTemplate: () => void;
  onSendMessage: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

export function ChatWindow({
  agent,
  session,
  messages,
  typing,
  draftMessage,
  modelOptions,
  selectedModelId,
  onSelectModel,
  onOpenChangeModel,
  onDraftChange,
  onAttach,
  onMention,
  onTemplate,
  onSendMessage,
  disabled = false,
  disabledReason
}: ChatWindowProps) {
  return (
    <section className="panel-base flex min-h-[620px] min-w-0 flex-col rounded-2xl">
      <ChatHeader agent={agent} modelOptions={modelOptions} onOpenChangeModel={onOpenChangeModel} onSelectModel={onSelectModel} selectedModelId={selectedModelId} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
        {session ? (
          <div className="rounded-xl border border-cyan-900/35 bg-sky-950/30 px-3 py-2 text-xs text-cyan-500">
            Session: <span className="text-cyan-300">{session.title}</span>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-cyan-900/35 bg-[#020a14] p-3">
          {messages.length ? (
            messages.map((message) => <ChatMessage agentName={agent?.name ?? "JARVIS"} key={message.id} message={message} />)
          ) : (
            <div className="flex h-full min-h-[120px] items-center justify-center rounded-lg border border-dashed border-cyan-900/50 px-4 text-center text-sm text-cyan-600">
              {disabledReason ?? "Start a message to begin this session."}
            </div>
          )}

          {typing && agent ? <TypingIndicator agentName={agent.name} /> : null}
        </div>

        <ChatInput
          disabled={disabled}
          modelOptions={modelOptions}
          onAttach={onAttach}
          onChange={onDraftChange}
          onMention={onMention}
          onModelChange={onSelectModel}
          onSend={onSendMessage}
          onTemplate={onTemplate}
          selectedModelId={selectedModelId}
          value={draftMessage}
        />

        <p className="inline-flex items-center gap-1 text-xs text-cyan-700">
          <AlertCircle className="h-3.5 w-3.5" />
          AI responses can make mistakes. Verify important information.
        </p>
      </div>
    </section>
  );
}
