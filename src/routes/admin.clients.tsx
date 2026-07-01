import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, ExternalLink, Search, Mail, KeyRound } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { invitePortalUser, submitClientCredentials } from "@/lib/onboarding.functions";
import { toast } from "sonner";


export const Route = createFileRoute("/admin/clients")({
  head: () => ({ meta: [{ title: "Clients — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / CLIENTS">
        <ClientsPage />
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
  monthly_value: number | null;
  pricing_tier: string | null;
  lead_id: string;
  deal_id: string;
  report_id: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_FILTERS = ["all", "onboarding", "active", "paused", "churned"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function fmtMoney(n: number | null) {
  if (!n) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function ClientsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  // Realtime: reflect provisioning + portal handoff instantly.
  useEffect(() => {
    const channel = supabase
      .channel("admin-clients-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients" },
        () => qc.invalidateQueries({ queryKey: ["clients"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credentials_vault" },
        () => qc.invalidateQueries({ queryKey: ["clients"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);


  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.company_name.toLowerCase().includes(q) ||
          c.contact_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.client_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [clients, filter, search]);

  const stats = useMemo(() => {
    const active = clients.filter((c) => c.status === "active");
    const onboarding = clients.filter((c) => c.status === "onboarding");
    const mrr = active.reduce((s, c) => s + (c.monthly_value ?? 0), 0);
    const portalCount = clients.filter((c) => c.portal_created).length;
    return { active: active.length, onboarding: onboarding.length, mrr, portalCount };
  }, [clients]);

  const selected = selectedId ? clients.find((c) => c.id === selectedId) ?? null : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="ma-label mt-1">Active accounts, onboarding state, and portal handoff</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric label="Active clients" value={String(stats.active)} />
        <Metric label="Onboarding" value={String(stats.onboarding)} />
        <Metric label="MRR" value={fmtMoney(stats.mrr)} />
        <Metric label="Portals live" value={`${stats.portalCount} / ${clients.length}`} />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-md p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded capitalize ${
                filter === f
                  ? "bg-[color:var(--surface-2)] text-white"
                  : "text-[color:var(--text-secondary)] hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contact, email…"
            className="w-full bg-[color:var(--surface)] border border-[color:var(--border)] rounded-md pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-[color:var(--text-secondary)] focus:outline-none focus:border-[color:var(--accent-red)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <section className="ma-panel">
          <table className="w-full text-sm">
            <thead className="text-xs text-[color:var(--text-secondary)] uppercase">
              <tr className="border-b border-[color:var(--border)]">
                <th className="text-left px-4 py-2 font-medium">Client</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Onboarding</th>
                <th className="text-right px-4 py-2 font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[color:var(--text-secondary)]">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[color:var(--text-secondary)]">
                    No clients match
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const isSelected = c.id === selectedId;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`border-b border-[color:var(--border)] last:border-0 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[color:var(--surface-2)]"
                        : "hover:bg-[color:var(--surface-2)]"
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-white">{c.company_name}</div>
                      <div className="text-xs text-[color:var(--text-secondary)] font-mono">
                        {c.client_id}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[color:var(--text-secondary)] capitalize">
                      {c.onboarding_step.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {fmtMoney(c.monthly_value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <aside>
          {selected ? (
            <ClientDetail client={selected} />
          ) : (
            <div className="ma-panel p-8 text-center text-sm text-[color:var(--text-secondary)]">
              Select a client to view onboarding progress and portal status
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ClientDetail({ client }: { client: ClientRow }) {
  const qc = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("clients").update({ status }).eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const steps = [
    { key: "credentials_submitted", label: "Credentials submitted", done: client.credentials_submitted },
    { key: "n8n_provisioned", label: "n8n instance provisioned", done: client.n8n_provisioned },
    { key: "portal_created", label: "Client portal created", done: client.portal_created },
  ];

  return (
    <div className="space-y-4">
      <div className="ma-panel p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="ma-label">{client.client_id}</div>
            <h2 className="text-lg font-bold text-white mt-1">{client.company_name}</h2>
            <div className="text-sm text-[color:var(--text-secondary)] mt-0.5">
              {client.contact_name} · {client.email}
            </div>
          </div>
          <StatusBadge status={client.status} />
        </div>

        <dl className="grid grid-cols-2 gap-3 mt-5 text-xs">
          <Field label="Pricing tier" value={client.pricing_tier ?? "—"} />
          <Field label="MRR" value={fmtMoney(client.monthly_value)} />
          <Field label="Created" value={client.created_at.slice(0, 10)} />
          <Field
            label="Portal live since"
            value={client.portal_created_at ? client.portal_created_at.slice(0, 10) : "—"}
          />
        </dl>
      </div>

      <div className="ma-panel p-5">
        <div className="text-sm font-semibold text-white mb-3">Onboarding</div>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              {s.done ? (
                <CheckCircle2 size={15} className="text-[color:var(--accent-red)]" />
              ) : (
                <Circle size={15} className="text-[color:var(--text-secondary)]" />
              )}
              <span className={s.done ? "text-white" : "text-[color:var(--text-secondary)]"}>
                {s.label}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-xs text-[color:var(--text-secondary)]">
          Current step: <span className="text-white capitalize">{client.onboarding_step.replaceAll("_", " ")}</span>
        </div>
      </div>

      {client.n8n_instance_url && (
        <div className="ma-panel p-5">
          <div className="text-sm font-semibold text-white mb-2">n8n Instance</div>
          <div className="text-xs text-[color:var(--text-secondary)]">
            {client.n8n_instance_name ?? "—"}
          </div>
          <a
            href={client.n8n_instance_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-[color:var(--accent-red)] hover:underline"
          >
            Open instance <ExternalLink size={11} />
          </a>
        </div>
      )}

      <div className="ma-panel p-5">
        <div className="text-sm font-semibold text-white mb-3">Change status</div>
        <div className="flex flex-wrap gap-2">
          {["onboarding", "active", "paused", "churned"].map((s) => (
            <button
              key={s}
              onClick={() => statusMutation.mutate(s)}
              disabled={s === client.status || statusMutation.isPending}
              className="ma-btn text-xs capitalize disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active"
      ? "text-[color:var(--accent-red)]"
      : status === "churned"
        ? "text-[color:var(--text-secondary)]"
        : "text-white";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${color}`}>
      <span className="ma-status-dot" />
      <span className="capitalize">{status}</span>
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ma-label">{label}</dt>
      <dd className="text-white mt-0.5">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ma-panel p-5">
      <div className="ma-label">{label}</div>
      <div className="text-2xl font-bold mt-2 text-white">{value}</div>
    </div>
  );
}
