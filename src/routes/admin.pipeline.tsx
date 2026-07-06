import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kanban, List as ListIcon, X } from "lucide-react";

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

interface LeadCard {
  id: string;
  lead_id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string;
  priority: string | null;
  hermes_lead_id: string | null;
  updated_at: string;
}

async function fetchStages(): Promise<Stage[]> {
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("id,slug,name,order_index,color,agent_owner,agent_action")
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as Stage[];
}

async function fetchLeads(): Promise<LeadCard[]> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id,lead_id,company_name,first_name,last_name,email,status,priority,hermes_lead_id,updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadCard[];
}

function Pipeline() {
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const stagesQ = useQuery({ queryKey: ["pipeline-stages"], queryFn: fetchStages });
  const leadsQ = useQuery({ queryKey: ["pipeline-leads"], queryFn: fetchLeads });

  // Realtime sync
  useEffect(() => {
    const ch = supabase
      .channel("pipeline-leads-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        qc.invalidateQueries({ queryKey: ["pipeline-leads"] });
        qc.invalidateQueries({ queryKey: ["leads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["pipeline-leads"] });
      const prev = qc.getQueryData<LeadCard[]>(["pipeline-leads"]);
      qc.setQueryData<LeadCard[]>(["pipeline-leads"], (old) =>
        (old ?? []).map((d) => (d.id === id ? { ...d, status } : d)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pipeline-leads"], ctx.prev);
      toast.error("Failed to move lead");
    },
    onSuccess: () => toast.success("Lead moved"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-leads"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const leadsByStage = useMemo(() => {
    const map = new Map<string, LeadCard[]>();
    for (const s of stagesQ.data ?? []) map.set(s.slug, []);
    const unassigned: LeadCard[] = [];
    for (const l of leadsQ.data ?? []) {
      if (map.has(l.status)) {
        map.get(l.status)!.push(l);
      } else {
        unassigned.push(l);
      }
    }
    return { map, unassigned };
  }, [stagesQ.data, leadsQ.data]);

  const activeLead = (leadsQ.data ?? []).find((d) => d.id === activeId) ?? null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const leadId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const lead = (leadsQ.data ?? []).find((d) => d.id === leadId);
    if (!lead || lead.status === overId) return;
    moveMutation.mutate({ id: leadId, status: overId });
  }

  const total = (leadsQ.data ?? []).length;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1>Pipeline</h1>
          <div className="ma-label mt-2">{total} leads across {(stagesQ.data ?? []).length} stages</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === "kanban" ? "default" : "outline"}
            onClick={() => setView("kanban")}
          >
            <Kanban size={14} /> Kanban
          </Button>
          <Button
            size="sm"
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
          >
            <ListIcon size={14} /> List
          </Button>
        </div>
      </div>

      {leadsByStage.unassigned.length > 0 && (
        <div className="ma-panel p-3 border-[color:var(--accent-red)]/40">
          <div className="ma-label mb-2 text-[color:var(--accent-red)]">
            {leadsByStage.unassigned.length} lead(s) with unrecognized status
          </div>
          <div className="flex gap-2 flex-wrap">
            {leadsByStage.unassigned.map((l) => (
              <div key={l.id} className="text-[11px] font-mono text-[color:var(--text-secondary)]">
                {l.lead_id} → <span className="text-white">{l.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                leads={leadsByStage.map.get(s.slug) ?? []}
              />
            ))}
          </div>
          <DragOverlay>{activeLead ? <LeadCardView lead={activeLead} dragging /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <LeadList leads={leadsQ.data ?? []} stages={stagesQ.data ?? []} />
      )}
    </div>
  );
}

function StageColumn({ stage, leads }: { stage: Stage; leads: LeadCard[] }) {
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
            {leads.length}
          </div>
        </div>
        <div className="ma-label mt-1 text-[10px]">
          {stage.agent_owner ?? "—"}
        </div>
      </div>
      <div className="p-2 flex-1 space-y-2 min-h-[120px]">
        {leads.map((l) => (
          <DraggableLead key={l.id} lead={l} />
        ))}
        {leads.length === 0 && (
          <div className="text-[11px] text-[color:var(--text-secondary)] px-2 py-4 text-center">
            {stage.agent_action ?? "Empty"}
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableLead({ lead }: { lead: LeadCard }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <LeadCardView lead={lead} />
    </div>
  );
}

function LeadCardView({ lead, dragging }: { lead: LeadCard; dragging?: boolean }) {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
  return (
    <Link
      to="/admin/leads/$leadId"
      params={{ leadId: lead.id }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`block bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded p-2.5 cursor-grab active:cursor-grabbing ${
        dragging ? "shadow-lg" : "hover:border-[color:var(--accent-red)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono text-[color:var(--text-secondary)] truncate">
          {lead.lead_id}
        </div>
        {lead.hermes_lead_id && (
          <span className="text-[9px] font-mono text-[color:var(--accent-red)]">HX</span>
        )}
      </div>
      <div className="text-sm font-semibold text-white mt-1 truncate">
        {lead.company_name ?? name ?? "—"}
      </div>
      {name && lead.company_name && (
        <div className="text-[11px] text-[color:var(--text-secondary)] truncate">{name}</div>
      )}
      {lead.email && (
        <div className="text-[10px] text-[color:var(--text-secondary)] truncate mt-0.5">
          {lead.email}
        </div>
      )}
      {lead.priority && (
        <div className="text-[10px] text-[color:var(--text-secondary)] uppercase mt-1">
          {lead.priority}
        </div>
      )}
    </Link>
  );
}

function LeadList({ leads, stages }: { leads: LeadCard[]; stages: Stage[] }) {
  const stageName = (slug: string) => stages.find((s) => s.slug === slug)?.name ?? slug;
  return (
    <div className="ma-panel overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]">
          <tr className="text-left">
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Lead</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Company</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Stage</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Priority</th>
            <th className="px-3 py-2 font-medium text-xs uppercase tracking-wider">Updated</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((d) => (
            <tr key={d.id} className="border-t border-[color:var(--border)] hover:bg-[color:var(--surface-2)]">
              <td className="px-3 py-2 font-mono text-xs">
                <Link to="/admin/leads/$leadId" params={{ leadId: d.id }} className="hover:text-[color:var(--accent-red)]">
                  {d.lead_id}
                </Link>
              </td>
              <td className="px-3 py-2 text-white">{d.company_name ?? "—"}</td>
              <td className="px-3 py-2">{stageName(d.status)}</td>
              <td className="px-3 py-2 text-[color:var(--text-secondary)]">{d.priority ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-[color:var(--text-secondary)]">
                {new Date(d.updated_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-[color:var(--text-secondary)]">
                No leads yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
