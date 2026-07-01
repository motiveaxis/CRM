import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / SETTINGS">
        <SettingsPage />
      </AdminShell>
    </StaffGuard>
  ),
});

interface AppSettings {
  id: number;
  agency_name: string | null;
  agency_email: string | null;
  agency_website: string | null;
  webhook_provision_instance: string | null;
  webhook_create_portal_user: string | null;
  webhook_notify_credentials: string | null;
  webhook_lead_normalize: string | null;
  webhook_ticket_updated: string | null;
  hourly_rate_for_savings: number | null;
  updated_at: string;
}

interface PipelineStage {
  id: string;
  name: string;
  slug: string;
  order_index: number;
  color: string | null;
  agent_owner: string | null;
  agent_action: string | null;
}

interface ApiConn {
  id: string;
  api_name: string;
  endpoint: string | null;
  monthly_cost: number | null;
  calls_this_month: number | null;
  status: string | null;
}

type TabKey = "agency" | "webhooks" | "pipeline" | "integrations" | "danger";

const TABS: { key: TabKey; label: string }[] = [
  { key: "agency", label: "Agency" },
  { key: "webhooks", label: "Webhooks" },
  { key: "pipeline", label: "Pipeline stages" },
  { key: "integrations", label: "Integrations" },
  { key: "danger", label: "Danger zone" },
];

function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("agency");
  return (
    <div className="space-y-6">
      <div>
        <div className="ma-label">Module 9</div>
        <h1 className="text-2xl font-semibold mt-1">Settings</h1>
        <p className="text-sm text-[color:var(--text-secondary)] mt-1">
          Agency config, webhooks, pipeline stages, and integrations.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[color:var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-mono uppercase border-b-2 -mb-px ${
              tab === t.key
                ? "border-[color:var(--accent-red)] text-white"
                : "border-transparent text-[color:var(--text-secondary)] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "agency" && <AgencyTab />}
      {tab === "webhooks" && <WebhooksTab />}
      {tab === "pipeline" && <PipelineTab />}
      {tab === "integrations" && <IntegrationsTab />}
      {tab === "danger" && <DangerTab />}
    </div>
  );
}

function useAppSettings() {
  return useQuery<AppSettings | null>({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AppSettings | null;
    },
  });
}

function AgencyTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useAppSettings();
  const [form, setForm] = useState<Partial<AppSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (data?.id) {
        const { error } = await supabase
          .from("app_settings")
          .update({
            agency_name: form.agency_name ?? null,
            agency_email: form.agency_email ?? null,
            agency_website: form.agency_website ?? null,
            hourly_rate_for_savings: form.hourly_rate_for_savings ?? null,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_settings").insert({
          agency_name: form.agency_name ?? null,
          agency_email: form.agency_email ?? null,
          agency_website: form.agency_website ?? null,
          hourly_rate_for_savings: form.hourly_rate_for_savings ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-[color:var(--text-muted)]">Loading…</div>;

  return (
    <div className="ma-panel p-5 max-w-2xl space-y-4">
      <h2 className="text-sm font-semibold">Agency identity</h2>
      <TextField
        label="Agency name"
        value={form.agency_name ?? ""}
        onChange={(v) => setForm({ ...form, agency_name: v })}
      />
      <TextField
        label="Contact email"
        type="email"
        value={form.agency_email ?? ""}
        onChange={(v) => setForm({ ...form, agency_email: v })}
      />
      <TextField
        label="Website"
        value={form.agency_website ?? ""}
        onChange={(v) => setForm({ ...form, agency_website: v })}
      />
      <TextField
        label="Hourly rate (for savings calc)"
        type="number"
        value={form.hourly_rate_for_savings?.toString() ?? ""}
        onChange={(v) => setForm({ ...form, hourly_rate_for_savings: v ? Number(v) : null })}
      />
      <div className="flex justify-end">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="px-4 py-2 text-xs font-mono uppercase bg-[color:var(--accent-red)] text-white rounded disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function WebhooksTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useAppSettings();
  const [form, setForm] = useState<Partial<AppSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data?.id) {
        const { error } = await supabase.from("app_settings").insert({
          webhook_provision_instance: form.webhook_provision_instance ?? null,
          webhook_create_portal_user: form.webhook_create_portal_user ?? null,
          webhook_notify_credentials: form.webhook_notify_credentials ?? null,
          webhook_lead_normalize: form.webhook_lead_normalize ?? null,
          webhook_ticket_updated: form.webhook_ticket_updated ?? null,
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("app_settings")
        .update({
          webhook_provision_instance: form.webhook_provision_instance ?? null,
          webhook_create_portal_user: form.webhook_create_portal_user ?? null,
          webhook_notify_credentials: form.webhook_notify_credentials ?? null,
          webhook_lead_normalize: form.webhook_lead_normalize ?? null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Webhooks saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-[color:var(--text-muted)]">Loading…</div>;

  const hooks: { key: keyof AppSettings; label: string; help: string }[] = [
    { key: "webhook_lead_normalize", label: "Lead normalize", help: "POST when new lead enters intake" },
    { key: "webhook_provision_instance", label: "Provision n8n instance", help: "Fires from Portals → Provision" },
    { key: "webhook_create_portal_user", label: "Create portal user", help: "Fires from Portals → Mark live" },
    { key: "webhook_notify_credentials", label: "Credentials submitted", help: "Notify ops when client submits creds" },
  ];

  return (
    <div className="ma-panel p-5 max-w-3xl space-y-4">
      <h2 className="text-sm font-semibold">n8n webhook endpoints</h2>
      <p className="text-xs text-[color:var(--text-muted)]">
        Full URLs. The app POSTs JSON payloads to these on the relevant lifecycle events.
      </p>
      {hooks.map((h) => (
        <div key={h.key}>
          <div className="ma-label">{h.label}</div>
          <div className="text-[10px] text-[color:var(--text-muted)] mb-1">{h.help}</div>
          <input
            value={(form[h.key] as string | null) ?? ""}
            onChange={(e) => setForm({ ...form, [h.key]: e.target.value })}
            placeholder="https://n8n.motiveaxis.com/webhook/…"
            className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-3 py-1.5 text-sm font-mono"
          />
        </div>
      ))}
      <div className="flex justify-end">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="px-4 py-2 text-xs font-mono uppercase bg-[color:var(--accent-red)] text-white rounded disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save webhooks"}
        </button>
      </div>
    </div>
  );
}

function PipelineTab() {
  const qc = useQueryClient();
  const { data: stages = [], isLoading } = useQuery<PipelineStage[]>({
    queryKey: ["pipeline-stages-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PipelineStage[];
    },
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PipelineStage> }) => {
      const { error } = await supabase.from("pipeline_stages").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-stages-admin"] });
      qc.invalidateQueries({ queryKey: ["pipeline-stages"] });
      toast.success("Stage updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-[color:var(--text-muted)]">Loading…</div>;

  return (
    <div className="ma-panel">
      <div className="p-4 border-b border-[color:var(--border)]">
        <h2 className="text-sm font-semibold">Pipeline stages</h2>
        <p className="text-xs text-[color:var(--text-muted)] mt-1">
          Order, color, and which agent owns the stage.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase font-mono text-[color:var(--text-muted)] border-b border-[color:var(--border)]">
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Slug</th>
            <th className="px-4 py-2">Color</th>
            <th className="px-4 py-2">Agent owner</th>
            <th className="px-4 py-2">Agent action</th>
          </tr>
        </thead>
        <tbody>
          {stages.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-[color:var(--text-muted)]">No stages configured</td></tr>
          )}
          {stages.map((s) => (
            <tr key={s.id} className="border-b border-[color:var(--border)]">
              <td className="px-4 py-2 font-mono text-xs">{s.order_index}</td>
              <td className="px-4 py-2">
                <input
                  defaultValue={s.name}
                  onBlur={(e) => e.target.value !== s.name && updateStage.mutate({ id: s.id, patch: { name: e.target.value } })}
                  className="bg-transparent border-b border-transparent hover:border-[color:var(--border)] focus:border-[color:var(--accent-red)] focus:outline-none text-sm"
                />
              </td>
              <td className="px-4 py-2 text-xs font-mono text-[color:var(--text-muted)]">{s.slug}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded border border-[color:var(--border)]" style={{ background: s.color ?? "#666" }} />
                  <input
                    defaultValue={s.color ?? ""}
                    placeholder="#hex"
                    onBlur={(e) => e.target.value !== (s.color ?? "") && updateStage.mutate({ id: s.id, patch: { color: e.target.value || null } })}
                    className="w-20 bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                </div>
              </td>
              <td className="px-4 py-2">
                <input
                  defaultValue={s.agent_owner ?? ""}
                  onBlur={(e) => e.target.value !== (s.agent_owner ?? "") && updateStage.mutate({ id: s.id, patch: { agent_owner: e.target.value || null } })}
                  className="w-full bg-transparent border-b border-transparent hover:border-[color:var(--border)] focus:border-[color:var(--accent-red)] focus:outline-none text-xs font-mono"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  defaultValue={s.agent_action ?? ""}
                  onBlur={(e) => e.target.value !== (s.agent_action ?? "") && updateStage.mutate({ id: s.id, patch: { agent_action: e.target.value || null } })}
                  className="w-full bg-transparent border-b border-transparent hover:border-[color:var(--border)] focus:border-[color:var(--accent-red)] focus:outline-none text-xs"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntegrationsTab() {
  const { data: apis = [], isLoading } = useQuery<ApiConn[]>({
    queryKey: ["settings-api-conns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_connections")
        .select("id, api_name, endpoint, monthly_cost, calls_this_month, status")
        .order("monthly_cost", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ApiConn[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="ma-panel p-5">
        <h2 className="text-sm font-semibold">Supabase</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs font-mono">
          <Field label="Project ref">exrxcrzekbcrkihkfdlf</Field>
          <Field label="URL">{import.meta.env.VITE_SUPABASE_URL ?? "—"}</Field>
        </div>
        <p className="text-xs text-[color:var(--text-muted)] mt-3">
          Secrets are managed in Lovable Cloud, not in this UI.
        </p>
      </div>

      <div className="ma-panel">
        <div className="p-4 border-b border-[color:var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold">External API connections</h2>
          <span className="text-xs text-[color:var(--text-muted)] font-mono">{apis.length}</span>
        </div>
        {isLoading ? (
          <div className="p-4 text-sm text-[color:var(--text-muted)]">Loading…</div>
        ) : apis.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--text-muted)] text-center">No API connections recorded</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase font-mono text-[color:var(--text-muted)] border-b border-[color:var(--border)]">
                <th className="px-4 py-2">API</th>
                <th className="px-4 py-2">Endpoint</th>
                <th className="px-4 py-2 text-right">Calls/mo</th>
                <th className="px-4 py-2 text-right">Cost/mo</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {apis.map((a) => (
                <tr key={a.id} className="border-b border-[color:var(--border)]">
                  <td className="px-4 py-2 font-medium">{a.api_name}</td>
                  <td className="px-4 py-2 text-xs font-mono text-[color:var(--text-secondary)] truncate max-w-[280px]">{a.endpoint ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">{a.calls_this_month ?? 0}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs">${(a.monthly_cost ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-xs">{a.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DangerTab() {
  return (
    <div className="ma-panel p-5 max-w-2xl border-[color:var(--accent-red)]/40">
      <h2 className="text-sm font-semibold text-[color:var(--accent-red)]">Danger zone</h2>
      <p className="text-xs text-[color:var(--text-muted)] mt-2">
        Destructive operations live here. None implemented yet — wire to n8n cleanup flows when ready.
      </p>
      <div className="mt-4 space-y-2">
        <button disabled className="w-full text-left px-3 py-2 text-xs font-mono uppercase border border-[color:var(--border)] rounded opacity-50 cursor-not-allowed">
          Purge demo leads
        </button>
        <button disabled className="w-full text-left px-3 py-2 text-xs font-mono uppercase border border-[color:var(--border)] rounded opacity-50 cursor-not-allowed">
          Reset pipeline stages to defaults
        </button>
        <button disabled className="w-full text-left px-3 py-2 text-xs font-mono uppercase border border-[color:var(--accent-red)]/40 text-[color:var(--accent-red)] rounded opacity-50 cursor-not-allowed">
          Wipe all client data
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <div className="ma-label mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-3 py-1.5 text-sm"
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="ma-label">{label}</div>
      <div className="text-sm mt-0.5">{children}</div>
    </div>
  );
}
