"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  Database,
  Gauge,
  HardDrive,
  Link2,
  Plus,
  RefreshCw,
  SquarePen
} from "lucide-react";

import { AddModelModal } from "@/components/models/add-model-modal";
import { CircularOverviewChart } from "@/components/models/circular-overview-chart";
import { DeleteModelModal } from "@/components/models/delete-model-modal";
import { EditModelModal } from "@/components/models/edit-model-modal";
import { ModelMenuAction } from "@/components/models/model-action-menu";
import { ModelsGrid } from "@/components/models/models-grid";
import { ModelsTable } from "@/components/models/models-table";
import { ProviderBreakdownItem } from "@/components/models/provider-breakdown-item";
import { QuickActionCard } from "@/components/models/quick-action-card";
import { SearchToolbar } from "@/components/models/search-toolbar";
import { SidebarPanel } from "@/components/models/sidebar-panel";
import { StatsCard } from "@/components/models/stats-card";
import { SyncQuotaModal } from "@/components/models/sync-quota-modal";
import { TestConnectionModal } from "@/components/models/test-connection-modal";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ActionButtonGroup } from "@/components/shared/action-button-group";
import { PageHeader } from "@/components/shared/page-header";
import { ToastItem, ToastStack } from "@/components/ui/toast-stack";
import { fetchDataResource } from "@/lib/api-client";
import { models as baseModels } from "@/lib/data/models";
import { systemServices, systemStats } from "@/lib/data/system";
import { Model, ModelStatus, ModelType } from "@/types/model";

type SortOption = "recent" | "usage_desc" | "usage_asc" | "name_asc" | "provider";

const pageSize = 8;

const quickActions = [
  { key: "add", title: "Add New Model", description: "Upcoming: connect a new AI model", icon: Plus, upcoming: true },
  { key: "test", title: "Test Model Connection", description: "Upcoming: run manual endpoint tests", icon: Link2, upcoming: true },
  { key: "sync", title: "Sync Model Quotas", description: "Upcoming: refresh usage and limits", icon: RefreshCw, upcoming: true },
  { key: "templates", title: "Model Templates", description: "Upcoming: use prebuilt model configs", icon: SquarePen, upcoming: true }
] as const;


function sortModels(models: Model[], sortBy: SortOption) {
  const sorted = [...models];

  if (sortBy === "recent") {
    sorted.sort((a, b) => new Date(b.addedOn).getTime() - new Date(a.addedOn).getTime());
    return sorted;
  }
  if (sortBy === "usage_desc") {
    sorted.sort((a, b) => b.usage - a.usage);
    return sorted;
  }
  if (sortBy === "usage_asc") {
    sorted.sort((a, b) => a.usage - b.usage);
    return sorted;
  }
  if (sortBy === "provider") {
    sorted.sort((a, b) => a.provider.localeCompare(b.provider));
    return sorted;
  }

  sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>(() => baseModels);
  const modelsQuery = useQuery({ queryKey: ["data", "models"], queryFn: () => fetchDataResource("models", baseModels) });
  const systemQuery = useQuery({ queryKey: ["data", "system"], queryFn: () => fetchDataResource("system", { stats: systemStats, services: systemServices }) });
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ModelStatus>("ALL");
  const [providerFilter, setProviderFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ModelType>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [compactCards, setCompactCards] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeModal, setActiveModal] = useState<null | "add" | "edit" | "test" | "delete" | "sync">(null);
  const selectedModel = undefined as Model | undefined;
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (modelsQuery.data?.data) queueMicrotask(() => setModels(modelsQuery.data.data));
  }, [modelsQuery.data]);

  const pushToast = useCallback((payload: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, ...payload }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const providerOptions = useMemo(() => Array.from(new Set(models.map((model) => model.provider))), [models]);

  const filteredModels = useMemo(() => {
    const queried = models.filter((model) => {
      const matchesSearch =
        !searchValue.trim() ||
        [model.name, model.provider, model.description, model.version, model.status, model.type].join(" ").toLowerCase().includes(searchValue.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || model.status === statusFilter;
      const matchesProvider = providerFilter === "ALL" || model.provider === providerFilter;
      const matchesType = typeFilter === "ALL" || model.type === typeFilter;
      return matchesSearch && matchesStatus && matchesProvider && matchesType;
    });

    return sortModels(queried, sortBy);
  }, [models, providerFilter, searchValue, sortBy, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredModels.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedModels = filteredModels.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const counts = useMemo(() => {
    const total = models.length;
    const active = models.filter((model) => model.status === "ACTIVE").length;
    const idle = models.filter((model) => model.status === "IDLE").length;
    const offline = models.filter((model) => model.status === "OFFLINE").length;
    const error = models.filter((model) => model.status === "ERROR").length;
    const local = models.filter((model) => model.type === "LOCAL").length;
    const api = models.filter((model) => model.type === "API").length;
    const avgUsage = total ? Math.round(models.reduce((sum, model) => sum + model.usage, 0) / total) : 0;
    return { total, active, idle, offline, error, local, api, avgUsage };
  }, [models]);

  const providerBreakdown = useMemo(() => {
    const buckets = ["OpenAI", "Anthropic", "Meta", "Google", "Mistral AI", "Ollama", "Microsoft", "Others"];

    return buckets.map((provider) => {
      const count =
        provider === "Others"
          ? models.filter((model) => !["OpenAI", "Anthropic", "Meta", "Google", "Mistral AI", "Ollama", "Microsoft"].includes(model.provider)).length
          : models.filter((model) => model.provider === provider).length;
      return { provider, count };
    });
  }, [models]);

  const closeModal = () => setActiveModal(null);

  const showUpcoming = useCallback((description: string, tone: ToastItem["tone"] = "info") => {
    pushToast({ title: "Upcoming feature", description, tone });
  }, [pushToast]);

  const handleAddModel = () => {
    showUpcoming("Adding models will be enabled after secure provider credential storage and validation are added.");
  };

  const handleEditModel = () => {
    showUpcoming("Editing live model configuration requires the secure provider settings API first.");
  };

  const handleDeleteModel = () => {
    showUpcoming("Deleting model configuration is blocked until approval controls are implemented.", "warning");
  };

  const handleSyncQuota = () => {
    showUpcoming("Quota sync will be enabled after provider-specific usage APIs are connected.");
  };

  const handleTestComplete = () => {
    showUpcoming("Manual test results will be enabled after the live provider test runner is added.");
  };

  const handleMenuAction = (_model: Model, action: ModelMenuAction) => {
    showUpcoming(`${action} for live models will be enabled after secure provider controls are added.`);
  };

  const handleQuickAction = (action: (typeof quickActions)[number]["key"]) => {
    if (action === "add") return showUpcoming("Adding models needs secure credential storage and provider validation first.");
    if (action === "test") return showUpcoming("Manual connection tests will use the live provider test runner in a later build.");
    if (action === "sync") return showUpcoming("Quota sync will connect to provider-specific usage APIs later.");
    return showUpcoming("Model template library will be connected in backend integration.");
  };

  return (
    <DashboardLayout system={systemQuery.data?.data.stats ?? systemStats}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-4">
          <PageHeader
            actions={
              <ActionButtonGroup>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-cyan-500/55 bg-cyan-500/20 px-4 text-sm text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/30"
                  onClick={() => showUpcoming("Adding models needs secure credential storage and provider validation first.")}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Add Model
                  <span className="rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[10px] uppercase text-amber-200">Upcoming</span>
                </button>
              </ActionButtonGroup>
            }
            subtitle="Live local/provider model data from this Mac. Controls marked Upcoming are intentionally not active yet."
            title="Models"
          />

          <section className="rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Live mode is enabled: dummy models were removed. Local Ollama and configured provider checks are shown; model management controls are marked Upcoming.
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatsCard description="All models" icon={Database} label="Total Models" tone="cyan" value={counts.total} />
            <StatsCard description="Currently active" icon={Activity} label="Active Models" tone="green" value={counts.active} />
            <StatsCard description="Unreachable providers" icon={HardDrive} label="Offline" tone="amber" value={counts.offline} />
            <StatsCard description="Connected via API" icon={Bot} label="API Models" tone="slate" value={counts.api} />
            <StatsCard description="System capacity" icon={Gauge} label="Total Usage" tone="rose" value={`${counts.avgUsage}%`} />
          </section>

          <section className="panel-base rounded-2xl p-4 sm:p-5">
            <SearchToolbar
              compactCards={compactCards}
              onProviderChange={(value) => {
                setProviderFilter(value);
                setCurrentPage(1);
              }}
              onSearchChange={(value) => {
                setSearchValue(value);
                setCurrentPage(1);
              }}
              onSortChange={(value) => {
                setSortBy(value);
                setCurrentPage(1);
              }}
              onStatusChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              onToggleLayout={() => setCompactCards((current) => !current)}
              onReset={() => {
                setSearchValue("");
                setStatusFilter("ALL");
                setProviderFilter("ALL");
                setTypeFilter("ALL");
                setSortBy("recent");
                setCurrentPage(1);
              }}
              onTypeChange={(value) => {
                setTypeFilter(value);
                setCurrentPage(1);
              }}
              providerFilter={providerFilter}
              providerOptions={providerOptions}
              searchValue={searchValue}
              sortBy={sortBy}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
            />
          </section>

          <ModelsGrid compact={compactCards} models={filteredModels} onManage={(model) => handleMenuAction(model, "manage")} onMenuAction={handleMenuAction} />

          <ModelsTable
            currentPage={safeCurrentPage}
            models={pagedModels}
            onManage={(model) => handleMenuAction(model, "manage")}
            onMenuAction={handleMenuAction}
            onPageChange={(page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)))}
            pageSize={pageSize}
            totalModels={filteredModels.length}
            totalPages={totalPages}
          />
        </main>

        <aside className="space-y-4">
          <SidebarPanel title="Models Overview">
            <CircularOverviewChart active={counts.active} error={counts.error} idle={counts.idle} local={counts.local} total={counts.total} />
          </SidebarPanel>

          <SidebarPanel title="Provider Breakdown">
            <div className="space-y-2.5">
              {providerBreakdown.map((provider) => (
                <ProviderBreakdownItem count={provider.count} key={provider.provider} provider={provider.provider} total={counts.total} />
              ))}
            </div>
          </SidebarPanel>

          <SidebarPanel title="Quick Actions">
            <div className="space-y-2.5">
              {quickActions.map((action) => (
                <QuickActionCard
                  description={action.description}
                  icon={action.icon}
                  key={action.key}
                  onClick={() => handleQuickAction(action.key)}
                  title={action.title}
                  upcoming={action.upcoming}
                />
              ))}
            </div>
          </SidebarPanel>
        </aside>
      </div>

      <AddModelModal onAdd={handleAddModel} onClose={closeModal} open={activeModal === "add"} providerOptions={providerOptions} />

      <EditModelModal
        model={selectedModel}
        onClose={closeModal}
        onSave={handleEditModel}
        open={activeModal === "edit"}
        providerOptions={providerOptions}
      />

      <TestConnectionModal model={selectedModel} onClose={closeModal} onComplete={handleTestComplete} open={activeModal === "test"} />

      <SyncQuotaModal model={selectedModel} onClose={closeModal} onSync={handleSyncQuota} open={activeModal === "sync"} />

      <DeleteModelModal model={selectedModel} onClose={closeModal} onDelete={handleDeleteModel} open={activeModal === "delete"} />

      <ToastStack toasts={toasts} />
    </DashboardLayout>
  );
}
