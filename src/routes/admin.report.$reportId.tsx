import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, CheckCircle2, Send, Plus, Trash2, X } from "lucide-react";
import { generateReportHTML, type ReportData, type ReportSection, type LeadLite } from "@/lib/report-html";

export const Route = createFileRoute("/admin/report/$reportId")({
  head: () => ({ meta: [{ title: "Report Editor — MotiveAxis CRM" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / REPORTS / EDIT">
        <ReportEditorPage />
      </AdminShell>
    </StaffGuard>
  ),
});

const DELIVERY_WEBHOOK = "https://n8n.motiveaxis.com/webhook/delivery-trigger";
const REQUIRED_SECTION_IDS = new Set(["executive_summary", "investment"]);
const PRICING_TIERS = ["Starter", "Retainer", "Custom"];

interface ReportRow {
  id: string;
  report_id: string;
  lead_id: string | null;
  qc_status: string | null;
  report_status: string;
  data: any;
  pdf_url: string | null;
  sent_at: string | null;
}
interface LeadRow extends LeadLite {
  id: string;
  lead_id: string;
}

function parseReportData(report: ReportRow): any {
  let raw = report.data;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  return raw && typeof raw === "object" ? raw : null;
}

function prepareReportData(report: ReportRow): ReportData {
  const raw = parseReportData(report) ?? {};
  const metaObj = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  return {
    ...raw,
    metadata: {
      ...metaObj,
      report_id: metaObj.report_id ?? report.report_id,
    },
    sections: Array.isArray(raw.sections) ? raw.sections : [],
  };
}

async function fetchReport(reportId: string) {
  const { data, error } = await supabase
    .from("reports")
    .select("id,report_id,lead_id,qc_status,report_status,data,pdf_url,sent_at")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw error;
  return data as ReportRow | null;
}
async function fetchLead(leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("id,lead_id,first_name,last_name,company_name,email,booking_status,cta_source")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw error;
  return data as LeadRow | null;
}

function ReportEditorPage() {
  const { reportId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const reportQ = useQuery({ queryKey: ["report", reportId], queryFn: () => fetchReport(reportId) });
  const report = reportQ.data ?? null;
  const leadQ = useQuery({
    queryKey: ["lead-for-report", report?.lead_id],
    queryFn: () => (report?.lead_id ? fetchLead(report.lead_id) : Promise.resolve(null)),
    enabled: !!report?.lead_id,
  });
  const lead = leadQ.data ?? null;

  const [edited, setEdited] = useState<ReportData | null>(null);
  useEffect(() => {
    if (!report) {
      setEdited(null);
      return;
    }
    if (report) setEdited(JSON.parse(JSON.stringify(prepareReportData(report))));
  }, [report]);

  const parsedData = report ? parseReportData(report) : null;
  const isLegacy = !!report && (!parsedData || !Array.isArray(parsedData.sections));

  const previewHTML = useMemo(() => {
    if (!edited || isLegacy) return "";
    return generateReportHTML(edited, lead);
  }, [edited, lead, isLegacy]);

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!report || !edited) return;
      const base = parseReportData(report) ?? {};
      const nextData = { ...base, metadata: base.metadata, sections: edited.sections };
      const { error } = await supabase.from("reports").update({ data: nextData }).eq("id", report.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["report", reportId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const approve = useMutation({
    mutationFn: async () => {
      if (!report) return;
      const { error } = await supabase
        .from("reports")
        .update({ qc_status: "approved", qc_approved_at: new Date().toISOString(), report_status: "qc_approved" })
        .eq("id", report.id);
      if (error) throw error;
      if (report.lead_id) {
        await supabase.from("qc_records").insert({
          report_id: report.id,
          lead_id: report.lead_id,
          agent_reviewed: "report-editor",
          qc_status: "approved",
          source: "manual",
          reviewed_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: ["report", reportId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Approve failed"),
  });

  const sendReport = useMutation({
    mutationFn: async () => {
      if (!report || !edited) throw new Error("Report not loaded");
      if (report.qc_status !== "approved") throw new Error("Approve before sending");
      const html = generateReportHTML(edited, lead);
      const nextData = { ...(report.data ?? {}), metadata: (report.data ?? {}).metadata, sections: edited.sections };
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("reports")
        .update({ data: nextData, report_status: "sent", sent_at: nowIso })
        .eq("id", report.id);
      if (error) throw error;

      const payload = {
        reportId: report.report_id,
        leadId: report.lead_id,
        email: lead?.email ?? "",
        first_name: lead?.first_name ?? "",
        company: lead?.company_name ?? "",
        reportData: nextData,
        html,
        booking_status: lead?.booking_status ?? "",
        cta_source: lead?.cta_source ?? "",
      };
      const res = await fetch(DELIVERY_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Delivery webhook returned ${res.status}`);
      const json = await res.json().catch(() => ({}));
      return json as { resend_id?: string; email_id?: string };
    },
    onSuccess: (json) => {
      const id = json?.resend_id || json?.email_id;
      toast.success(id ? `Sent · ${id}` : "Sent to delivery");
      qc.invalidateQueries({ queryKey: ["report", reportId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Send failed"),
  });

  if (reportQ.isLoading) return <div className="text-sm text-[color:var(--text-secondary)]">Loading report…</div>;
  if (!report) return <div className="text-sm">Report not found. <Link to="/admin/reports" className="underline">Back</Link></div>;
  if (!edited) return <div className="text-sm text-[color:var(--text-secondary)]">Loading report…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => navigate({ to: "/admin/reports" })}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div>
          <div className="ma-label">Report</div>
          <div className="font-mono text-white text-sm">{report.report_id}</div>
        </div>
        {lead && (
          <div>
            <div className="ma-label">Lead</div>
            <div className="text-white text-sm">
              {lead.company_name} · {lead.first_name} {lead.last_name}
            </div>
          </div>
        )}
        <StatusBadge label="QC" value={report.qc_status ?? "none"} />
        <StatusBadge label="Status" value={report.report_status} />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending || isLegacy}>
            <Save size={14} /> Save
          </Button>
          <Button
            size="sm"
            onClick={() => approve.mutate()}
            disabled={approve.isPending || report.qc_status === "approved" || isLegacy}
          >
            <CheckCircle2 size={14} /> Approve
          </Button>
          <Button
            size="sm"
            onClick={() => sendReport.mutate()}
            disabled={sendReport.isPending || report.qc_status !== "approved" || isLegacy}
            title={report.qc_status !== "approved" ? "Approve first" : undefined}
          >
            <Send size={14} /> {report.sent_at ? "Resend" : "Approve & Send"}
          </Button>
        </div>
      </div>

      {isLegacy ? (
        <div className="ma-panel p-6 text-sm text-[color:var(--text-secondary)]">
          This report uses a legacy format and cannot be edited. Generate a new report to use the editor.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: "70vh" }}>
          <div className="ma-panel p-4 overflow-auto" style={{ maxHeight: "82vh" }}>
            <SectionsEditor value={edited!} onChange={setEdited} />
          </div>
          <div className="ma-panel overflow-hidden" style={{ height: "82vh" }}>
            <iframe
              title="report-preview"
              srcDoc={previewHTML}
              style={{ width: "100%", height: "100%", border: "none", background: "#0A0A0A" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <div className="ma-label">{label}</div>
      <span className="inline-flex items-center px-2 py-0.5 rounded border border-[color:var(--border)] font-mono uppercase text-[10px] text-white">
        {value}
      </span>
    </div>
  );
}

function SectionsEditor({ value, onChange }: { value: ReportData; onChange: (v: ReportData) => void }) {
  const sections = value.sections ?? [];

  const update = (idx: number, patch: Partial<ReportSection>) => {
    const next = sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, sections: next });
  };
  const remove = (idx: number) => {
    const next = sections.filter((_, i) => i !== idx);
    onChange({ ...value, sections: next });
  };
  const add = () => {
    const next = [
      ...sections,
      { id: `custom_${Date.now()}`, title: "New Section", type: "text", content: "" } as ReportSection,
    ];
    onChange({ ...value, sections: next });
  };

  return (
    <div className="space-y-4">
      {sections.map((s, idx) => (
        <div key={s.id + idx} className="border border-[color:var(--border)] rounded p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={s.title}
              onChange={(e) => update(idx, { title: e.target.value })}
              className="font-semibold"
            />
            <span className="text-[10px] font-mono text-[color:var(--text-secondary)] uppercase">{s.type}</span>
            <button
              onClick={() => remove(idx)}
              disabled={REQUIRED_SECTION_IDS.has(s.id)}
              className="text-[color:var(--text-secondary)] hover:text-[color:var(--accent-red)] disabled:opacity-30"
              title={REQUIRED_SECTION_IDS.has(s.id) ? "Required section" : "Remove"}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <SectionBody section={s} onChange={(patch) => update(idx, patch)} />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add}>
        <Plus size={14} /> Add Section
      </Button>
    </div>
  );
}

function SectionBody({ section, onChange }: { section: ReportSection; onChange: (patch: Partial<ReportSection>) => void }) {
  switch (section.type) {
    case "text":
      return (
        <Textarea
          rows={5}
          value={section.content ?? ""}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      );
    case "metrics": {
      const d = section.data ?? {};
      const set = (k: string, v: any) => onChange({ data: { ...d, [k]: v } });
      return (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Hours / week"><Input type="number" value={d.hours_lost_weekly ?? 0} onChange={(e) => set("hours_lost_weekly", Number(e.target.value))} /></Field>
          <Field label="Hours / month"><Input type="number" value={d.hours_lost_monthly ?? 0} onChange={(e) => set("hours_lost_monthly", Number(e.target.value))} /></Field>
          <Field label="Error risk"><Input value={d.error_risk ?? ""} onChange={(e) => set("error_risk", e.target.value)} /></Field>
          <div className="col-span-3">
            <Field label="Bottleneck"><Textarea rows={3} value={d.bottleneck_description ?? ""} onChange={(e) => set("bottleneck_description", e.target.value)} /></Field>
          </div>
        </div>
      );
    }
    case "list": {
      const it = section.items ?? {};
      const setItems = (patch: any) => onChange({ items: { ...it, ...patch } });
      return (
        <div className="space-y-3">
          <ArrayEditor label="Triggers" values={it.automation_triggers ?? []} onChange={(v) => setItems({ automation_triggers: v })} />
          <ArrayEditor label="Actions" values={it.automation_actions ?? []} onChange={(v) => setItems({ automation_actions: v })} />
          <Field label="Expected efficiency gain">
            <Input value={it.expected_efficiency_gain ?? ""} onChange={(e) => setItems({ expected_efficiency_gain: e.target.value })} />
          </Field>
        </div>
      );
    }
    case "stack": {
      const d = section.data ?? {};
      const set = (patch: any) => onChange({ data: { ...d, ...patch } });
      return (
        <div className="space-y-3">
          <Field label="Primary tool"><Input value={d.primary_tool ?? ""} onChange={(e) => set({ primary_tool: e.target.value })} /></Field>
          <ArrayEditor label="Integrations" values={d.integrations ?? []} onChange={(v) => set({ integrations: v })} />
        </div>
      );
    }
    case "phases": {
      const d = section.data ?? {};
      const set = (k: string, v: string) => onChange({ data: { ...d, [k]: v } });
      return (
        <div className="space-y-2">
          <Field label="Phase 1"><Textarea rows={2} value={d.phase1 ?? ""} onChange={(e) => set("phase1", e.target.value)} /></Field>
          <Field label="Phase 2"><Textarea rows={2} value={d.phase2 ?? ""} onChange={(e) => set("phase2", e.target.value)} /></Field>
          <Field label="Phase 3"><Textarea rows={2} value={d.phase3 ?? ""} onChange={(e) => set("phase3", e.target.value)} /></Field>
        </div>
      );
    }
    case "roi": {
      const d = section.data ?? {};
      const set = (k: string, v: any) => onChange({ data: { ...d, [k]: v } });
      return (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Hours saved / month"><Input type="number" value={d.hours_saved_monthly ?? 0} onChange={(e) => set("hours_saved_monthly", Number(e.target.value))} /></Field>
          <Field label="Hours saved / year"><Input type="number" value={d.hours_saved_annually ?? 0} onChange={(e) => set("hours_saved_annually", Number(e.target.value))} /></Field>
          <Field label="Labor $ / month"><Input value={d.labor_cost_recovered_monthly_usd ?? ""} onChange={(e) => set("labor_cost_recovered_monthly_usd", e.target.value)} /></Field>
          <Field label="Payback (weeks)"><Input type="number" step="0.1" value={d.payback_period_weeks ?? 0} onChange={(e) => set("payback_period_weeks", Number(e.target.value))} /></Field>
        </div>
      );
    }
    case "pricing": {
      const d = section.data ?? {};
      const set = (k: string, v: any) => onChange({ data: { ...d, [k]: v } });
      return (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tier">
            <select
              value={d.recommended_tier ?? "Starter"}
              onChange={(e) => set("recommended_tier", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {PRICING_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Price display"><Input value={d.price_display ?? ""} onChange={(e) => set("price_display", e.target.value)} /></Field>
          <Field label="Price value"><Input type="number" value={d.price_value ?? 0} onChange={(e) => set("price_value", Number(e.target.value))} /></Field>
          <div className="col-span-2">
            <Field label="Rationale"><Textarea rows={3} value={d.rationale ?? ""} onChange={(e) => set("rationale", e.target.value)} /></Field>
          </div>
        </div>
      );
    }
    case "list_items": {
      const items: string[] = Array.isArray(section.items) ? section.items : [];
      return <ArrayEditor label="Items" values={items} onChange={(v) => onChange({ items: v })} />;
    }
    default:
      return (
        <Textarea
          rows={4}
          value={JSON.stringify(section.data ?? section.content ?? "", null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange({ data: parsed });
            } catch {
              /* ignore */
            }
          }}
        />
      );
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="ma-label mb-1">{label}</div>
      {children}
    </div>
  );
}

function ArrayEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div className="ma-label mb-1">{label}</div>
      <div className="space-y-1">
        {values.map((v, i) => (
          <div key={i} className="flex gap-1">
            <Input
              value={v}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-[color:var(--text-secondary)] hover:text-[color:var(--accent-red)] px-1"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => onChange([...values, ""])}>
          <Plus size={12} /> Add
        </Button>
      </div>
    </div>
  );
}
