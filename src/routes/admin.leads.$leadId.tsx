import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/leads/$leadId")({
  head: () => ({ meta: [{ title: "Lead — MotiveAxis CRM" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / LEADS / DETAIL">
        <LeadDetail />
      </AdminShell>
    </StaffGuard>
  ),
});

const STATUS_OPTIONS = [
  "new",
  "lead_qualified",
  "report_generation",
  "report_qc_pending",
  "report_qc_approved",
  "report_sent",
  "engaged",
  "conversion_signal",
  "proposal",
  "closed_won",
  "closed_lost",
];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

function LeadDetail() {
  const { leadId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (lead) setForm(lead); }, [lead]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({
        company_name: form.company_name,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        source: form.source,
        vertical: form.vertical,
        priority: form.priority,
        status: form.status,
        notes: form.notes,
      }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead updated");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      navigate({ to: "/admin/leads" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) return <div className="text-[color:var(--text-secondary)]">Loading…</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/leads" className="ma-label inline-flex items-center gap-1 hover:text-white">
            <ChevronLeft size={12} /> Back to leads
          </Link>
          <div className="flex items-baseline gap-3 mt-2 flex-wrap">
            <h1>{form.company_name}</h1>
            <span className="font-mono text-sm text-[color:var(--text-secondary)]">{form.lead_id}</span>
            <span className="font-mono text-xs text-[color:var(--text-secondary)]">•</span>
            <span className="font-mono text-xs text-[color:var(--text-secondary)]">
              {form.hermes_lead_id ?? "Hermes ID: Pending"}
            </span>
            <EmailTypeBadge type={form.email_type} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 size={14} /> Delete
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="bg-[color:var(--accent-red)] hover:bg-[color:var(--accent-red)]/90">
            <Save size={14} /> {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="ma-panel p-5 lg:col-span-2 space-y-4">
          <div className="ma-label">Lead profile</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
            <div />
            <Field label="First name" value={form.first_name ?? ""} onChange={(v) => setForm({ ...form, first_name: v })} />
            <Field label="Last name" value={form.last_name ?? ""} onChange={(v) => setForm({ ...form, last_name: v })} />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Source" value={form.source ?? ""} onChange={(v) => setForm({ ...form, source: v })} />
            <Field label="Vertical" value={form.vertical ?? ""} onChange={(v) => setForm({ ...form, vertical: v })} />
          </div>
          <div>
            <Label className="ma-label">Notes</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={5}
              className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="ma-panel p-5 space-y-3">
            <div className="ma-label">Status</div>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="bg-[color:var(--surface-2)] border-[color:var(--border)]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="ma-label pt-2">Priority</div>
            <Select value={form.priority ?? "medium"} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger className="bg-[color:var(--surface-2)] border-[color:var(--border)]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="ma-panel p-5">
            <div className="ma-label mb-3">UTM attribution</div>
            <dl className="space-y-1.5 text-xs font-mono">
              <Row k="source" v={form.utm_source} />
              <Row k="medium" v={form.utm_medium} />
              <Row k="campaign" v={form.utm_campaign} />
              <Row k="term" v={form.utm_term} />
              <Row k="content" v={form.utm_content} />
            </dl>
          </div>

          <div className="ma-panel p-5">
            <div className="ma-label mb-2">Metadata</div>
            <dl className="space-y-1.5 text-xs font-mono">
              <Row k="created" v={new Date(form.created_at).toLocaleString()} />
              <Row k="updated" v={new Date(form.updated_at).toLocaleString()} />
            </dl>
          </div>
        </div>
      </div>

      <LeadAxisDiagnostic lead={form} />
      <InteractionsPanel leadId={leadId} />
    </div>
  );
}

function EmailTypeBadge({ type }: { type?: string | null }) {
  if (!type || type === "unknown") return null;
  const isBusiness = type === "business";
  return (
    <span
      className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
      style={
        isBusiness
          ? { border: "1px solid #FF001E", color: "#FF001E", background: "rgba(255,0,30,0.08)" }
          : { border: "1px solid #2A2A2A", color: "#8A8A93" }
      }
    >
      {type}
    </span>
  );
}

function LeadAxisDiagnostic({ lead }: { lead: any }) {
  const processed = !!lead.hermes_lead_id;
  const ts = lead.tool_stack ?? {};
  const hasStack = ["crm", "automation", "project_management", "communication", "other"].some(
    (k) => Array.isArray(ts[k]) && ts[k].length > 0,
  );
  const pain: string[] = Array.isArray(lead.pain_points) ? lead.pain_points : [];
  const goals: string[] = Array.isArray(lead.goals) ? lead.goals : [];
  const qd = lead.quantified_data ?? {};

  return (
    <div className="ma-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="ma-label">Lead-Axis Diagnostic</div>
        {!processed && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "#444444" }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#FF001E" }} />
            Awaiting Lead-Axis processing
          </div>
        )}
      </div>

      {!processed ? (
        <p className="text-xs text-[color:var(--text-secondary)]">
          Lead created manually. Agent normalization triggered. This section updates automatically.
        </p>
      ) : (
        <div className="space-y-5">
          <div>
            <div className="ma-label mb-2">Tool Stack</div>
            {hasStack ? (
              <div className="space-y-2">
                {(["crm", "automation", "project_management", "communication", "other"] as const).map((k) =>
                  Array.isArray(ts[k]) && ts[k].length > 0 ? (
                    <div key={k} className="flex items-center gap-2 flex-wrap">
                      <span className="ma-label w-32 shrink-0">{k.replace("_", " ")}</span>
                      {ts[k].map((tag: string, i: number) => (
                        <span
                          key={i}
                          className="font-mono text-xs px-2 py-0.5 rounded"
                          style={{
                            background: "rgba(255,0,30,0.06)",
                            border: "1px solid #2A2A2A",
                            color: "#FFFFFF",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null,
                )}
              </div>
            ) : (
              <p className="text-xs text-[color:var(--text-secondary)]">—</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div className="ma-label mb-2">Pain Points</div>
              {pain.length ? (
                <ol className="list-decimal pl-5 space-y-1 text-sm text-white">
                  {pain.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              ) : <p className="text-xs text-[color:var(--text-secondary)]">—</p>}
            </div>
            <div>
              <div className="ma-label mb-2">Goals</div>
              {goals.length ? (
                <ol className="list-decimal pl-5 space-y-1 text-sm text-[color:var(--text-secondary)]">
                  {goals.map((g, i) => <li key={i}>{g}</li>)}
                </ol>
              ) : <p className="text-xs text-[color:var(--text-secondary)]">—</p>}
            </div>
          </div>

          <div>
            <div className="ma-label mb-2">Quantified Data</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetricCard label="Hours / Week" value={qd.hours_per_week_mentioned} />
              <MetricCard label="Hours / Month" value={qd.hours_per_month_mentioned} />
              <MetricCard label="Team Size" value={qd.team_size_mentioned} />
              <MetricCard label="Frequency" value={qd.frequency_mentioned} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: any }) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="ma-panel p-3 text-center">
      <div className="font-mono text-xl text-white">{display}</div>
      <div className="ma-label mt-1">{label}</div>
    </div>
  );
}

function InteractionsPanel({ leadId }: { leadId: string }) {
  const { data: items = [] } = useQuery({
    queryKey: ["interactions", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions" as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="ma-panel p-5">
      <div className="ma-label mb-3">Interactions</div>
      {items.length === 0 ? (
        <p className="text-xs text-[color:var(--text-secondary)]">No interactions logged yet.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)]">
          {items.map((it: any) => (
            <li key={it.id} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-white">{it.type}</span>
                  <span
                    className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded"
                    style={
                      it.source === "agent"
                        ? { color: "#8A8A93", border: "1px solid #2A2A2A" }
                        : { color: "#444444", border: "1px solid #2A2A2A" }
                    }
                  >
                    {it.source === "agent" ? "Sales-Axis" : "Manual"}
                  </span>
                  {it.requires_human_review && (
                    <span
                      className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(255,0,30,0.1)", color: "#FF001E", border: "1px solid #FF001E" }}
                    >
                      • Human Review
                    </span>
                  )}
                </div>
                {it.content_summary && (
                  <p className="text-sm text-[color:var(--text-secondary)] mt-1">{it.content_summary}</p>
                )}
              </div>
              <div className="font-mono text-[10px] text-[color:var(--text-secondary)] shrink-0">
                {new Date(it.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="ma-label">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]" />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[color:var(--text-secondary)]">{k}</dt>
      <dd className="text-white truncate">{v || "—"}</dd>
    </div>
  );
}
