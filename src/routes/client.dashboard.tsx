import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/client/dashboard")({
  head: () => ({ meta: [{ title: "Portal — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="CLIENT / DASHBOARD">
        <Dashboard />
      </ClientShell>
    </ClientGuard>
  ),
});

function Dashboard() {
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

  if (!client) {
    return (
      <div className="ma-panel p-8">
        <div className="ma-accent-bar mb-6" />
        <div className="ma-label mb-2">Status / Pending</div>
        <h2>No client record linked to this account</h2>
        <p className="text-sm text-[color:var(--text-secondary)] mt-3 max-w-lg">
          Your portal access is provisioned by MotiveAxis after contract signature. If you believe this is an error, contact your account manager.
        </p>
      </div>
    );
  }

  const cards = [
    { label: "Active automations", value: "—", sub: "Built in next turn" },
    { label: "Hours saved / mo", value: "—", sub: "Aggregated" },
    { label: "API cost / mo", value: "—", sub: "Current period" },
    { label: "Onboarding step", value: client.onboarding_step, sub: client.status },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1>{client.company_name}</h1>
        <div className="ma-label mt-2">Client ID {client.client_id}</div>
      </div>

      {!client.credentials_submitted && (
        <div className="ma-panel border-[color:var(--accent-red)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="ma-status-dot" />
            <div className="text-sm">
              <strong>Action required</strong> — Submit your credentials to begin your automation build →
            </div>
          </div>
          <button className="text-xs bg-[color:var(--accent-red)] text-white px-4 py-2 rounded-[4px] font-semibold">
            Submit credentials →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="ma-panel p-5 relative">
            <div className="absolute top-0 left-0 right-0 ma-accent-bar" />
            <div className="ma-label">{c.label}</div>
            <div className="ma-metric text-2xl mt-3 capitalize">{c.value}</div>
            <div className="text-[11px] text-[color:var(--text-secondary)] mt-2 capitalize">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
