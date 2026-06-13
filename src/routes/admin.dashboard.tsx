import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MotiveAxis CRM" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / DASHBOARD">
        <Dashboard />
      </AdminShell>
    </StaffGuard>
  ),
});

interface Metrics {
  totalLeads: number;
  leadsThisMonth: number;
  pipelineValue: number;
  activeClients: number;
  mrr: number;
}

async function fetchMetrics(): Promise<Metrics> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const [leads, monthLeads, deals, clients] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()),
    supabase.from("deals").select("deal_value, stage").not("stage", "in", "(closed_won,closed_lost)"),
    supabase.from("clients").select("id, status, monthly_value").eq("status", "active"),
  ]);

  const pipelineValue = (deals.data ?? []).reduce((sum, d) => sum + Number(d.deal_value ?? 0), 0);
  const mrr = (clients.data ?? []).reduce((sum, c) => sum + Number(c.monthly_value ?? 0), 0);

  return {
    totalLeads: leads.count ?? 0,
    leadsThisMonth: monthLeads.count ?? 0,
    pipelineValue,
    activeClients: clients.data?.length ?? 0,
    mrr,
  };
}

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-metrics"], queryFn: fetchMetrics });

  const cards = [
    { label: "Total leads", value: data?.totalLeads ?? 0, sub: "All-time intake" },
    { label: "Leads this month", value: data?.leadsThisMonth ?? 0, sub: "Month-to-date" },
    { label: "Pipeline value", value: data ? fmt(data.pipelineValue) : "—", sub: "Active deals" },
    { label: "Active clients", value: data?.activeClients ?? 0, sub: "Currently engaged" },
    { label: "MRR", value: data ? fmt(data.mrr) : "—", sub: "Monthly recurring" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1>Command Dashboard</h1>
        <div className="ma-label mt-2">Operational metrics — live</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="ma-panel p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 ma-accent-bar" />
            <div className="ma-label">{c.label}</div>
            <div className="ma-metric text-3xl mt-3">{isLoading ? "—" : c.value}</div>
            <div className="text-[11px] text-[color:var(--text-secondary)] mt-2">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="ma-panel p-5 lg:col-span-2">
          <div className="ma-label mb-4">Pipeline funnel</div>
          <div className="text-sm text-[color:var(--text-secondary)]">
            Funnel visualization renders once the Leads and Pipeline modules are built in the next turn.
          </div>
        </div>
        <div className="ma-panel p-5">
          <div className="ma-label mb-4">Recent activity</div>
          <div className="text-sm text-[color:var(--text-secondary)]">
            Activity feed populates as records move through the system.
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}
