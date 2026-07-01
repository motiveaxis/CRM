import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { Workflow, Clock, DollarSign, Activity } from "lucide-react";

export const Route = createFileRoute("/client/automations")({
  head: () => ({ meta: [{ title: "Automations — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="PORTAL / AUTOMATIONS">
        <Page />
      </ClientShell>
    </ClientGuard>
  ),
});

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

function Metric({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }) {
  return (
    <div className="ma-panel p-5 relative">
      <div className="absolute top-0 left-0 right-0 ma-accent-bar" />
      <div className="flex items-center justify-between">
        <div className="ma-label">{label}</div>
        <Icon size={14} strokeWidth={1.5} />
      </div>
      <div className="ma-metric text-2xl mt-3">{value}</div>
      {sub && <div className="text-[11px] text-[color:var(--text-secondary)] mt-2">{sub}</div>}
    </div>
  );
}

function Page() {
  const { user } = useSession();

  const { data: client } = useQuery({
    queryKey: ["client-self", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("portal_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: automations = [] } = useQuery({
    queryKey: ["client-automations", client?.id],
    enabled: !!client,
    queryFn: async () => {
      const { data } = await supabase
        .from("automations")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useRealtimeInvalidate("client-automations-rt", [
    {
      table: "automations",
      filter: client ? `client_id=eq.${client.id}` : undefined,
      queryKeys: [["client-automations", client?.id]],
    },
  ]);


  if (!client) {
    return <div className="ma-panel p-6 ma-label">No client record linked.</div>;
  }

  const active = automations.filter((a) => a.status === "active");
  const totalHours = automations.reduce((s, a) => s + (a.monthly_time_saved_hours ?? 0), 0);
  const totalCost = automations.reduce((s, a) => s + (a.monthly_cost ?? 0), 0);
  const errored = automations.filter((a) => a.status === "error").length;

  return (
    <div className="space-y-6">
      <div>
        <h1>Automations</h1>
        <div className="ma-label mt-2">{client.company_name}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Active" value={String(active.length)} sub={`${automations.length} total`} icon={Workflow} />
        <Metric label="Hours saved / mo" value={totalHours.toFixed(1)} sub="Aggregated" icon={Clock} />
        <Metric label="Monthly cost" value={`$${totalCost.toFixed(2)}`} sub="API + run cost" icon={DollarSign} />
        <Metric label="Errors" value={String(errored)} sub={errored ? "Needs attention" : "All healthy"} icon={Activity} />
      </div>

      <div className="ma-panel">
        <div className="px-5 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
          <div className="ma-label">Workflows</div>
          <div className="text-[11px] text-[color:var(--text-secondary)]">{automations.length} records</div>
        </div>
        {automations.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--text-secondary)]">
            No automations provisioned yet. Your account manager will notify you once your first workflow goes live.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[color:var(--text-secondary)] uppercase tracking-wider">
                <th className="px-5 py-3 font-normal">Name</th>
                <th className="px-5 py-3 font-normal">Status</th>
                <th className="px-5 py-3 font-normal">Last run</th>
                <th className="px-5 py-3 font-normal text-right">Runs/mo</th>
                <th className="px-5 py-3 font-normal text-right">Hours/mo</th>
                <th className="px-5 py-3 font-normal text-right">Cost/mo</th>
              </tr>
            </thead>
            <tbody>
              {automations.map((a) => (
                <tr key={a.id} className="border-t border-[color:var(--border)]">
                  <td className="px-5 py-3">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-[11px] font-mono text-[color:var(--text-muted)]">{a.automation_id}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-[3px] ${
                      a.status === "active" ? "bg-emerald-500/15 text-emerald-300" :
                      a.status === "error" ? "bg-red-500/15 text-red-300" :
                      "bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]"
                    }`}>{a.status}</span>
                  </td>
                  <td className="px-5 py-3 text-[color:var(--text-secondary)]">{fmtDate(a.last_run_at)}</td>
                  <td className="px-5 py-3 text-right font-mono">{a.average_runs_per_month ?? 0}</td>
                  <td className="px-5 py-3 text-right font-mono">{(a.monthly_time_saved_hours ?? 0).toFixed(1)}</td>
                  <td className="px-5 py-3 text-right font-mono">${(a.monthly_cost ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
