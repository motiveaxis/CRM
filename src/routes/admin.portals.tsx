import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, KeyRound, Plug, Server, ShieldCheck, Workflow } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/portals")({
  head: () => ({ meta: [{ title: "Portals — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / PORTALS">
        <PortalsPage />
      </AdminShell>
    </StaffGuard>
  ),
});

interface ClientRow {
  id: string;
  client_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  status: string;
  onboarding_step: string;
  credentials_submitted: boolean;
  n8n_provisioned: boolean;
  n8n_provisioned_at: string | null;
  n8n_instance_url: string | null;
  n8n_instance_name: string | null;
  portal_created: boolean;
  portal_created_at: string | null;
  portal_user_id: string | null;
}

interface AutomationRow {
  id: string;
  automation_id: string;
  client_id: string;
  name: string;
  status: string;
  last_run_at: string | null;
  monthly_cost: number | null;
  monthly_time_saved_hours: number | null;
}

interface ApiConnectionRow {
  id: string;
  client_id: string;
  api_name: string;
  status: string;
  calls_this_month: number;
  monthly_cost: number | null;
}

interface VaultRow {
  id: string;
  client_id: string;
  submitted_at: string;
  encryption_key_ref: string | null;
}

function PortalsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["portals-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, client_id, company_name, contact_name, email, status, onboarding_step, credentials_submitted, n8n_provisioned, n8n_provisioned_at, n8n_instance_url, n8n_instance_name, portal_created, portal_created_at, portal_user_id",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  const { data: automations = [] } = useQuery({
    queryKey: ["portals-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("id, automation_id, client_id, name, status, last_run_at, monthly_cost, monthly_time_saved_hours");
      if (error) throw error;
      return (data ?? []) as AutomationRow[];
    },
  });

  const { data: apis = [] } = useQuery({
    queryKey: ["portals-apis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_connections")
        .select("id, client_id, api_name, status, calls_this_month, monthly_cost");
      if (error) throw error;
      return (data ?? []) as ApiConnectionRow[];
    },
  });

  const { data: vault = [] } = useQuery({
    queryKey: ["portals-vault"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credentials_vault")
        .select("id, client_id, submitted_at, encryption_key_ref");
      if (error) throw error;
      return (data ?? []) as VaultRow[];
    },
  });

  const stats = useMemo(() => {
    const provisioned = clients.filter((c) => c.n8n_provisioned).length;
    const portals = clients.filter((c) => c.portal_created).length;
    const awaitingCreds = clients.filter((c) => !c.credentials_submitted && c.status !== "churned").length;
    const awaitingProv = clients.filter((c) => c.credentials_submitted && !c.n8n_provisioned).length;
    return { provisioned, portals, awaitingCreds, awaitingProv };
  }, [clients]);

  const selected = selectedId ? clients.find((c) => c.id === selectedId) ?? null : null;
  const selectedAutomations = selected ? automations.filter((a) => a.client_id === selected.id) : [];
  const selectedApis = selected ? apis.filter((a) => a.client_id === selected.id) : [];
  const selectedVault = selected ? vault.find((v) => v.client_id === selected.id) ?? null : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Portals</h1>
        <p className="ma-label mt-1">
          n8n instance provisioning, credential vault, and portal user handoff
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric label="n8n provisioned" value={`${stats.provisioned} / ${clients.length}`} icon={Server} />
        <Metric label="Portals live" value={`${stats.portals} / ${clients.length}`} icon={ShieldCheck} />
        <Metric label="Awaiting credentials" value={String(stats.awaitingCreds)} icon={KeyRound} />
        <Metric label="Ready to provision" value={String(stats.awaitingProv)} icon={Workflow} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <section className="ma-panel">
          <div className="px-5 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
            <h2 className="text-sm font-semibold">Client portals</h2>
            <span className="ma-label">{clients.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-[color:var(--text-secondary)] uppercase">
              <tr className="border-b border-[color:var(--border)]">
                <th className="text-left px-5 py-2 font-medium">Client</th>
                <th className="text-left px-5 py-2 font-medium">Creds</th>
                <th className="text-left px-5 py-2 font-medium">n8n</th>
                <th className="text-left px-5 py-2 font-medium">Portal</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[color:var(--text-secondary)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && clients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[color:var(--text-secondary)]">
                    No clients yet
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`border-b border-[color:var(--border)] last:border-0 cursor-pointer transition-colors ${
                    c.id === selectedId
                      ? "bg-[color:var(--surface-2)]"
                      : "hover:bg-[color:var(--surface-2)]"
                  }`}
                >
                  <td className="px-5 py-2.5">
                    <div className="text-white">{c.company_name}</div>
                    <div className="text-xs font-mono text-[color:var(--text-secondary)]">{c.client_id}</div>
                  </td>
                  <td className="px-5 py-2.5"><Dot on={c.credentials_submitted} /></td>
                  <td className="px-5 py-2.5"><Dot on={c.n8n_provisioned} /></td>
                  <td className="px-5 py-2.5"><Dot on={c.portal_created} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside>
          {selected ? (
            <PortalDetail
              client={selected}
              automations={selectedAutomations}
              apis={selectedApis}
              vault={selectedVault}
            />
          ) : (
            <div className="ma-panel p-8 text-center text-sm text-[color:var(--text-secondary)]">
              Select a client to view portal, n8n, and vault status
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function PortalDetail({
  client,
  automations,
  apis,
  vault,
}: {
  client: ClientRow;
  automations: AutomationRow[];
  apis: ApiConnectionRow[];
  vault: VaultRow | null;
}) {
  const qc = useQueryClient();

  const provisionMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clients")
        .update({
          n8n_provisioned: true,
          n8n_provisioned_at: new Date().toISOString(),
          n8n_instance_name: client.n8n_instance_name ?? `ma-${client.client_id.toLowerCase()}`,
          n8n_instance_url:
            client.n8n_instance_url ?? `https://n8n.motiveaxis.com/${client.client_id.toLowerCase()}`,
          onboarding_step: "portal_pending",
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portals-clients"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("n8n instance marked provisioned");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clients")
        .update({
          portal_created: true,
          portal_created_at: new Date().toISOString(),
          status: "active",
          onboarding_step: "complete",
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portals-clients"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Portal marked live");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="ma-panel p-5">
        <div className="ma-label">{client.client_id}</div>
        <h2 className="text-lg font-bold text-white mt-1">{client.company_name}</h2>
        <div className="text-sm text-[color:var(--text-secondary)] mt-0.5">
          {client.contact_name} · {client.email}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stage label="Credentials" done={client.credentials_submitted} />
          <Stage label="n8n" done={client.n8n_provisioned} />
          <Stage label="Portal" done={client.portal_created} />
        </div>
      </div>

      <div className="ma-panel p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <KeyRound size={14} /> Credential vault
        </div>
        {vault ? (
          <div className="text-xs text-[color:var(--text-secondary)] space-y-1">
            <div>
              Submitted <span className="text-white">{vault.submitted_at.slice(0, 10)}</span>
            </div>
            <div>
              Key ref{" "}
              <span className="text-white font-mono">{vault.encryption_key_ref ?? "—"}</span>
            </div>
            <div className="text-[color:var(--accent-red)] mt-2">• Encrypted at rest</div>
          </div>
        ) : (
          <div className="text-xs text-[color:var(--text-secondary)]">
            No credentials submitted yet
          </div>
        )}
      </div>

      <div className="ma-panel p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <Server size={14} /> n8n instance
        </div>
        {client.n8n_provisioned ? (
          <div className="space-y-1 text-xs text-[color:var(--text-secondary)]">
            <div>
              Name <span className="text-white font-mono">{client.n8n_instance_name ?? "—"}</span>
            </div>
            <div className="truncate">
              URL{" "}
              {client.n8n_instance_url ? (
                <a
                  href={client.n8n_instance_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--accent-red)] hover:underline"
                >
                  {client.n8n_instance_url}
                </a>
              ) : (
                "—"
              )}
            </div>
            <div>
              Provisioned{" "}
              <span className="text-white">{client.n8n_provisioned_at?.slice(0, 10) ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-[color:var(--text-secondary)]">
              {client.credentials_submitted
                ? "Credentials received — ready to provision."
                : "Awaiting credentials before provisioning."}
            </div>
            <button
              disabled={!client.credentials_submitted || provisionMutation.isPending}
              onClick={() => provisionMutation.mutate()}
              className="ma-btn text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Mark provisioned
            </button>
          </div>
        )}
      </div>

      <div className="ma-panel p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <ShieldCheck size={14} /> Portal user
        </div>
        {client.portal_created ? (
          <div className="text-xs text-[color:var(--text-secondary)] space-y-1">
            <div>
              Live since{" "}
              <span className="text-white">{client.portal_created_at?.slice(0, 10) ?? "—"}</span>
            </div>
            <div className="font-mono truncate">
              User <span className="text-white">{client.portal_user_id ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-[color:var(--text-secondary)]">
              {client.n8n_provisioned
                ? "Instance live — create portal user to hand off."
                : "Provision n8n before creating portal."}
            </div>
            <button
              disabled={!client.n8n_provisioned || portalMutation.isPending}
              onClick={() => portalMutation.mutate()}
              className="ma-btn text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Mark portal live
            </button>
          </div>
        )}
      </div>

      <div className="ma-panel p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <Workflow size={14} /> Automations · {automations.length}
        </div>
        {automations.length === 0 ? (
          <div className="text-xs text-[color:var(--text-secondary)]">None bound</div>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {automations.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span className="text-white truncate pr-2">{a.name}</span>
                <span className="text-[color:var(--text-secondary)] font-mono shrink-0">
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ma-panel p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <Plug size={14} /> API connections · {apis.length}
        </div>
        {apis.length === 0 ? (
          <div className="text-xs text-[color:var(--text-secondary)]">None connected</div>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {apis.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span className="text-white truncate pr-2">{a.api_name}</span>
                <span className="text-[color:var(--text-secondary)] font-mono shrink-0">
                  {a.calls_this_month.toLocaleString()} calls
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        on ? "bg-[color:var(--accent-red)]" : "bg-[color:var(--border)]"
      }`}
    />
  );
}

function Stage({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className={`rounded border px-2 py-1.5 text-center ${
        done
          ? "border-[color:var(--accent-red)]/40 bg-[color:var(--accent-red)]/10"
          : "border-[color:var(--border)] bg-[color:var(--surface-2)]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-[color:var(--text-secondary)]">
        {label}
      </div>
      <div className={`text-xs mt-0.5 ${done ? "text-white" : "text-[color:var(--text-secondary)]"}`}>
        {done ? "Done" : "Pending"}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="ma-panel p-5">
      <div className="flex items-center gap-2 ma-label">
        <Icon size={12} /> {label}
      </div>
      <div className="text-2xl font-bold mt-2 text-white">{value}</div>
    </div>
  );
}

// suppress unused import warnings for icons that may be referenced conditionally
void Activity;
