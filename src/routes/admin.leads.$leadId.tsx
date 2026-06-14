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

const STATUS_OPTIONS = ["new", "contacted", "qualified", "report_sent", "negotiation", "closed_won", "closed_lost"];
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
          <div className="flex items-baseline gap-3 mt-2">
            <h1>{form.company_name}</h1>
            <span className="font-mono text-sm text-[color:var(--text-secondary)]">{form.lead_id}</span>
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
            <Field label="Contact" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
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
