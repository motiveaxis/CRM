import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { BarChart3, DollarSign, Plug, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/client/api-usage")({
  head: () => ({ meta: [{ title: "API Usage — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="PORTAL / API USAGE">
        <Page />
      </ClientShell>
    </ClientGuard>
  ),
});

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

  const { data: apis = [] } = useQuery({
    queryKey: ["client-apis", client?.client_id],
    enabled: !!client,
    queryFn: async () => {
      const { data } = await supabase
        .from("api_connections")
        .select("*")
        .eq("client_id", client!.client_id)
        .order("monthly_cost", { ascending: false });
      return data ?? [];
    },
  });

  if (!client) {
    return <div className="ma-panel p-6 ma-label">No client record linked.</div>;
  }

  const totalCalls = apis.reduce((s, a) => s + (a.calls_this_month ?? 0), 0);
  const totalCost = apis.reduce((s, a) => s + (a.monthly_cost ?? 0), 0);
  const issues = apis.filter((a) => a.status !== "active" && a.status !== "ok").length;
  const maxCost = Math.max(1, ...apis.map((a) => a.monthly_cost ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1>API Usage</h1>
        <div className="ma-label mt-2">Current billing period</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Connected APIs" value={String(apis.length)} icon={Plug} />
        <Metric label="Calls this month" value={totalCalls.toLocaleString()} icon={BarChart3} />
        <Metric label="Monthly spend" value={`$${totalCost.toFixed(2)}`} icon={DollarSign} />
        <Metric label="Issues" value={String(issues)} sub={issues ? "Action needed" : "All connected"} icon={AlertCircle} />
      </div>

      <div className="ma-panel">
        <div className="px-5 py-3 border-b border-[color:var(--border)] ma-label">By API</div>
        {apis.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--text-secondary)]">
            No API connections yet.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {apis.map((a) => {
              const pct = ((a.monthly_cost ?? 0) / maxCost) * 100;
              return (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-sm">{a.api_name}</div>
                      <div className="text-[11px] font-mono text-[color:var(--text-muted)]">{a.endpoint ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">${(a.monthly_cost ?? 0).toFixed(2)}</div>
                      <div className="text-[11px] text-[color:var(--text-secondary)]">
                        {(a.calls_this_month ?? 0).toLocaleString()} calls · ${(a.cost_per_call ?? 0).toFixed(4)}/call
                      </div>
                    </div>
                  </div>
                  <div className="h-1 bg-[color:var(--surface-2)] rounded-[2px] overflow-hidden">
                    <div className="h-full bg-[color:var(--accent-red)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
