import { ChatModel } from "@/types/chat";
import { cn } from "@/lib/utils";

type ModelCardProps = {
  model: ChatModel;
  active: boolean;
  onSelect: (modelId: string) => void;
};

const statusToneClass: Record<ChatModel["status"], string> = {
  ACTIVE: "text-emerald-300 border-emerald-500/35 bg-emerald-500/10",
  IDLE: "text-slate-300 border-slate-500/35 bg-slate-500/10",
  OFFLINE: "text-rose-300 border-rose-500/35 bg-rose-500/10",
  ERROR: "text-red-300 border-red-500/35 bg-red-500/10"
};

export function ModelCard({ model, active, onSelect }: ModelCardProps) {
  return (
    <button
      className={cn(
        "w-full rounded-xl border p-3 text-left transition",
        "border-cyan-900/35 bg-sky-950/35 hover:border-cyan-500/45 hover:bg-cyan-500/10",
        active && "border-cyan-500/65 bg-cyan-500/12"
      )}
      onClick={() => onSelect(model.id)}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-cyan-100">{model.name}</p>
          <p className="truncate text-xs text-cyan-600">{model.provider}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]", statusToneClass[model.status])}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {model.status}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-cyan-500">{model.description}</p>
    </button>
  );
}
