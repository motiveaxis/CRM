import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Kanban, List as ListIcon } from "lucide-react";

export const Route = createFileRoute("/admin/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — MotiveAxis CRM" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / PIPELINE">
        <Pipeline />
      </AdminShell>
    </StaffGuard>
  ),
});

interface Stage {
  id: string;
  slug: string;
  name: string;
  order_index: number;
  color: string | null;
  agent_owner: string | null;
  agent_action: string | null;
}

interface Deal {
  id: string;
  deal_id: string;
  lead_id: string | null;
  stage: string;
  deal_value: number | null;
  pricing_tier: string | null;
  close_probability: number | null;
  notes: string | null;
  updated_at: string;
  lead?: {
    company_name: string;
    first_name: string | null;
    last_name: string | null;
    hermes_lead_id: string | null;
    priority: string | null;
  } | null;
}

async function fetchStages(): Promise<Stage[]> {
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id,slug,name,order_index,color,agent_owner,agent_action")
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as Stage[];
}

async function fetchDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from("deals")
    .select(
      "id,deal_id,lead_id,stage,deal_value,pricing_tier,close_probability,notes,updated_at,lead:leads(company_name,first_name,last_name,hermes_lead_id,priority)",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Deal[];
}

function Pipeline() {
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);

  const stagesQ = useQuery({ queryKey: ["pipeline-stages"], queryFn: fetchStages });
  const dealsQ = useQuery({ queryKey: ["pipeline-deals"], queryFn: fetchDeals });

  const moveMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["pipeline-deals"] });
      const prev = qc.getQueryData<Deal[]>(["pipeline-deals"]);
      qc.setQueryData<Deal[]>(["pipeline-deals"], (old) =>
        (old ?? []).map((d) => (d.id === id ? { ...d, stage } : d)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pipeline-deals"], ctx.prev);
      toast.error("Failed to move deal");
    },
    onSuccess: () => toast.success("Deal moved"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["pipeline-deals"] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const s of stagesQ.data ?? []) map.set(s.slug, []);
    for (const d of dealsQ.data ?? []) {
      const arr = map.get(d.stage) ?? [];
      arr.push(d);
      map.set(d.stage, arr);
    }
    return map;
  }, [stagesQ.data, dealsQ.data]);

  const totalsByStage = useMemo(() => {
    const map = new Map<string, number>();
    for (const [slug, list] of dealsByStage)
      map.set(slug, list.reduce((s, d) => s + Number(d.deal_value ?? 0), 0));
    return map;
  }, [dealsByStage]);

  const totalPipeline = useMemo(
    () =>
      (dealsQ.data ?? [])
        .filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost")
        .reduce((s, d) => s + Number(d.deal_value ?? 0), 0),
    [dealsQ.data],
  );

  const activeDeal = (dealsQ.data ?? []).find((d) => d.id === activeId) ?? null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const dealId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const deal = (dealsQ.data ?? []).find((d) => d.id === dealId);
    if (!deal || deal.stage === overId) return;
    moveMutation.mutate({ id: dealId, stage: overId });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1>Pipeline</h1>
          <div className="ma-label mt-2">
            {(dealsQ.data ?? []).length} deals · ${Math.round(totalPipeline).toLocaleString()} active
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("kanban")}
            className={`ma-btn ${view === "kanban" ? "ma-btn-primary" : ""}`}
          >
            <Kanban size={14} /> Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={`ma-btn ${view === "list" ? "ma-btn-primary" : ""}`}
          >
            <ListIcon size={14} /> List
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {(stagesQ.data ?? []).map((s) => (
              <StageColumn
                key={s.slug}
                stage={s}
                deals={dealsByStage.get(s.slug) ?? []}
                total={totalsByStage.get(s.slug) ?? 0}
              />
            ))}
          </div>
          <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} dragging /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <DealList deals={dealsQ.data ?? []} stages={stagesQ.data ?? []} />
      )}
    </div>
  );
}

function StageColumn({ stage, deals, total }: { stage: Stage; deals: Deal[]; total: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.slug });
  return (
    <div
      ref={setNodeRef}
      className={`w-[280px] shrink-0 ma-panel flex flex-col ${
        isOver ? "ring-1 ring-[color:var(--accent-red)]" : ""
      }`}
    >
      <div className="px-3 py-2.5 border-b border-[color:var(--border)]">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: stage.color ?? "#444" }}
          />
          <div className="text-xs font-semibold uppercase tracking-wider text-white">
            {stage.name}
          </div>
          <div className="ml-auto text-[10px] text-[color:var(--text-secondary)] font-mono">
            {deals.length}
          </div>
        </div>
        <div className="ma-label mt-1 text-[10px]">
          {stage.agent_owner ?? "—"} · ${Math.round(total).toLocaleString()}
        </div>
      </div>
      <div className="p-2 flex-1 space-y-2 min-h-[120px]">
        {deals.map((d) => (
          <DraggableDeal key={d.id} deal={d} />
        ))}
        {deals.length === 0 && (
          <div className="text-[11px] text-[color:var(--text-secondary)] px-2 py-4 text-center">
            {stage.agent_action ?? "Empty"}
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableDeal({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <DealCard deal={deal} />
    </div>
  );
}

function DealCard({ deal, dragging }: { deal: Deal; dragging?: boolean }) {
  const name = [deal.lead?.first_name, deal.lead?.last_name].filter(Boolean).join(" ");
  return (
    <div
      className={`bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded p-2.5 cursor-grab active:cursor-grabbing ${
        dragging ? "shadow-lg" : "hover:border-[color:var(--accent-red)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono text-[color:var(--text-secondary)] truncate">
          {deal.deal_id}
        </div>
        {deal.lead?.hermes_lead_id && (
          <span className="text-[9px] font-mono text-[color:var(--accent-red)]">HX</span>
        )}
      </div>
      <div className="text-sm font-semibold text-white mt-1 truncate">
        {deal.lead?.company_name ?? "—"}
      </div>
      {name && (
        <div className="text-[11px] text-[color:var(--text-secondary)] truncate">{name}</div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="text-xs font-mono text-white">
          ${Math.round(Number(deal.deal_value ?? 0)).toLocaleString()}
        </div>
        {deal.close_probability != null && (
          <div className="text-[10px] text-[color:var(--text-secondary)]">
            {deal.close_probability}%
          </div>
        )}
      </div>
    </div>
  );
}

function DealList({ deals, stages }: { deals: Deal[]; stages: Stage[] }) {
  const stageName = (slug: string) => stages.find((s) => s.slug === slug)?.name ?? slug;
  return (
    <div className="ma-panel overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Deal</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Company</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Stage</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Value</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Prob</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Updated</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id} className="border-t border-[color:var(--border)] hover:bg-[color:var(--surface-2)]">
              <td className="px-3 py-2 font-mono text-xs">
                {d.lead_id ? (
                  <Link to="/admin/leads/$leadId" params={{ leadId: d.lead_id }} className="hover:text-[color:var(--accent-red)]">
                    {d.deal_id}
                  </Link>
                ) : (
                  d.deal_id
                )}
              </td>
              <td className="px-3 py-2 text-white">{d.lead?.company_name ?? "—"}</td>
              <td className="px-3 py-2">{stageName(d.stage)}</td>
              <td className="px-3 py-2 font-mono">
                ${Math.round(Number(d.deal_value ?? 0)).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono">{d.close_probability ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-[color:var(--text-secondary)]">
                {new Date(d.updated_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {deals.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-[color:var(--text-secondary)]">
                No deals yet. Deals are created from the Leads module when a lead is qualified.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
