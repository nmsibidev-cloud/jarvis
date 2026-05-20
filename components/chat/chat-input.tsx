"use client";

import { FormEvent } from "react";
import { AtSign, Paperclip, SendHorizontal, Sparkles } from "lucide-react";

import { ChatModel } from "@/types/chat";

type ChatInputProps = {
  value: string;
  disabled?: boolean;
  selectedModelId: string;
  modelOptions: ChatModel[];
  onChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
  onAttach: () => void;
  onMention: () => void;
  onTemplate: () => void;
  onSend: () => void;
};

const actionButtonClassName =
  "inline-flex h-9 items-center justify-center gap-1 rounded-md border border-cyan-900/40 bg-sky-950/45 px-2.5 text-xs text-cyan-300 transition hover:border-cyan-500/55 hover:text-cyan-100";

export function ChatInput({
  value,
  disabled = false,
  selectedModelId,
  modelOptions,
  onChange,
  onModelChange,
  onAttach,
  onMention,
  onTemplate,
  onSend
}: ChatInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) return;
    onSend();
  };

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <textarea
        className="h-28 w-full resize-none rounded-xl border border-cyan-900/45 bg-[#030d19] px-3 py-2.5 text-sm text-cyan-100 outline-none transition placeholder:text-cyan-700 focus:border-cyan-500/70 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={disabled ? "Select an online agent and active model to chat..." : "Type your message..."}
        value={value}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button className={actionButtonClassName} disabled={disabled} onClick={onAttach} type="button">
          <Paperclip className="h-3.5 w-3.5" />
          Attach
        </button>
        <button className={actionButtonClassName} disabled={disabled} onClick={onMention} type="button">
          <AtSign className="h-3.5 w-3.5" />
          Mention Agent
        </button>
        <button className={actionButtonClassName} disabled={disabled} onClick={onTemplate} type="button">
          <Sparkles className="h-3.5 w-3.5" />
          Prompt Template
        </button>

        <label className="ml-auto flex h-9 min-w-[180px] items-center gap-2 rounded-md border border-cyan-900/45 bg-sky-950/40 px-2 text-xs text-cyan-500">
          <select
            className="w-full bg-transparent text-xs text-cyan-200 outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || modelOptions.length === 0}
            onChange={(event) => onModelChange(event.target.value)}
            value={selectedModelId}
          >
            {modelOptions.map((model) => (
              <option className="bg-[#071523]" key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </label>

        <button
          className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-cyan-500/60 bg-cyan-500/18 px-3 text-xs text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/28 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || !value.trim()}
          type="submit"
        >
          <SendHorizontal className="h-3.5 w-3.5" />
          Send
        </button>
      </div>
    </form>
  );
}
