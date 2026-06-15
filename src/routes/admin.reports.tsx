import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, Send, CheckCircle2, XCircle, Clock, AlertTriangle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — MotiveAxis CRM" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / REPORTS">
        <Reports />
      </AdminShell>
    </StaffGuard>
  ),
});

interface Report {
  id: string;
  report_id: string;
  lead_id: string | null;
  vertical: string | null;
  diagnosis_summary: string | null;
  hours_saved_estimate: number | null;
  pricing_tier: string | null;
  pricing_value: number | null;
  pdf_url: string | null;
  report_status: string;
  sent_at: string | null;
  viewed_at: string | null;
  created_at: string;
  updated_at: string;
  hermes_report_id: string | null;
  qc_status: string | null;
  qc_approved_at: string | null;
  source: string | null;
  roi_summary: any;
  recommended_stack: any;
  lead?: { company_name: string; first_name: string | null; last_name: string | null } | null;
}

interface QcRecord {
  id: string;
  qc_id: string | null;
  agent_reviewed: string | null;
  report_id: string | null;
  qc_status: string;
  issues_found: any;
  corrections_applied: any;
  notes: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  source: string | null;
}

const STATUS_FILTERS = ["all", "draft", "qc_pending", "qc_approved", "sent", "viewed"] as const;

async function fetchReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id,report_id,lead_id,vertical,diagnosis_summary,hours_saved_estimate,pricing_tier,pricing_value,pdf_url,report_status,sent_at,viewed_at,created_at,updated_at,hermes_report_id,qc_status,qc_approved_at,source,roi_summary,recommended_stack,lead:leads(company_name,first_name,last_name)",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Report[];
}

async function fetchQcRecords(reportId: string): Promise<QcRecord[]> {
  const { data, error } = await supabase
    .from("qc_records")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as QcRecord[];
}

function Reports() {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reportsQ = useQuery({ queryKey: ["reports"], queryFn: fetchReports });
  const reports = reportsQ.data ?? [];

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filter === "qc_pending" && r.qc_status !== "pending" && r.report_status !== "qc_pending") return false;
      if (filter === "qc_approved" && r.qc_status !== "approved") return false;
      if (filter === "draft" && r.report_status !== "draft") return false;
      if (filter === "sent" && !r.sent_at) return false;
      if (filter === "viewed" && !r.viewed_at) return false;
      if (search) {
        const s = search.toLowerCase();
        const blob = [r.report_id, r.lead?.company_name, r.vertical, r.hermes_report_id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [reports, filter, search]);

  const stats = useMemo(() => {
    const pending = reports.filter((r) => r.qc_status === "pending").length;
    const approved = reports.filter((r) => r.qc_status === "approved").length;
    const sent = reports.filter((r) => r.sent_at).length;
    const viewed = reports.filter((r) => r.viewed_at).length;
    return { pending, approved, sent, viewed };
  }, [reports]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1>Reports</h1>
        <div className="ma-label mt-2">Report-Axis output · Zed QC pipeline · Sales-Axis delivery</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="QC pending" value={stats.pending} icon={Clock} accent />
        <StatCard label="QC approved" value={stats.approved} icon={CheckCircle2} />
        <StatCard label="Sent" value={stats.sent} icon={Send} />
        <StatCard label="Viewed by lead" value={stats.viewed} icon={FileText} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search id, company, vertical…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-1 border border-[color:var(--border)] rounded-md p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded ${
                filter === f
                  ? "bg-[color:var(--surface-2)] text-white"
                  : "text-[color:var(--text-secondary)] hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-[color:var(--text-secondary)]">
          {filtered.length} of {reports.length}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="ma-panel overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-2)] text-[color:var(--text-secondary)] text-xs uppercase tracking-wider">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Report</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">QC</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const name = [r.lead?.first_name, r.lead?.last_name].filter(Boolean).join(" ");
                const isSel = r.id === selectedId;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`border-t border-[color:var(--border)] cursor-pointer ${
                      isSel ? "bg-[color:var(--surface-2)]" : "hover:bg-[color:var(--surface-2)]"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <div className="text-white">{r.report_id}</div>
                      {r.hermes_report_id && (
                        <div className="text-[10px] text-[color:var(--accent-red)]">
                          {r.hermes_report_id}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-white">{r.lead?.company_name ?? "—"}</div>
                      {name && (
                        <div className="text-[11px] text-[color:var(--text-secondary)]">{name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <QcBadge status={r.qc_status} />
                    </td>
                    <td className="px-3 py-2 text-xs">{r.report_status}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      ${Math.round(Number(r.pricing_value ?? 0)).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-xs text-[color:var(--text-secondary)]">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[color:var(--text-secondary)]">
                    {reportsQ.isLoading ? "Loading…" : "No reports match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-1">
          {selected ? (
            <ReportDetail report={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="ma-panel p-5 text-sm text-[color:var(--text-secondary)]">
              Select a report to inspect Report-Axis output, QC audit trail, and delivery controls.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportDetail({ report, onClose }: { report: Report; onClose: () => void }) {
  const qc = useQueryClient();
  const qcRecordsQ = useQuery({
    queryKey: ["qc-records", report.id],
    queryFn: () => fetchQcRecords(report.id),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("reports")
        .update({ report_status: "sent", sent_at: new Date().toISOString() })
        .eq("id", report.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report marked as sent");
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });

  const approveMutation = useMutation({
    mutationFn: async (approve: boolean) => {
      const status = approve ? "approved" : "rejected";
      const { error: rErr } = await supabase
        .from("reports")
        .update({
          qc_status: status,
          qc_approved_at: approve ? new Date().toISOString() : null,
          report_status: approve ? "qc_approved" : "qc_pending",
        })
        .eq("id", report.id);
      if (rErr) throw rErr;
      if (!report.lead_id) throw new Error("Report has no linked lead");
      const { error: qErr } = await supabase.from("qc_records").insert({
        report_id: report.id,
        lead_id: report.lead_id,
        agent_reviewed: "report-axis",
        qc_status: status,
        source: "manual",
        reviewed_at: new Date().toISOString(),
      });
      if (qErr) throw qErr;
    },
    onSuccess: (_d, approve) => {
      toast.success(approve ? "Report approved" : "Report rejected");
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["qc-records", report.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "QC update failed"),
  });

  const canSend = report.qc_status === "approved";
  const name = [report.lead?.first_name, report.lead?.last_name].filter(Boolean).join(" ");

  return (
    <div className="ma-panel p-5 space-y-4 sticky top-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="ma-label">Report</div>
          <div className="text-white font-mono text-sm mt-1">{report.report_id}</div>
        </div>
        <button onClick={onClose} className="text-xs text-[color:var(--text-secondary)] hover:text-white">
          close
        </button>
      </div>

      <div>
        <div className="ma-label">Company</div>
        <div className="text-white text-sm mt-1">
          {report.lead_id ? (
            <Link
              to="/admin/leads/$leadId"
              params={{ leadId: report.lead_id! }}
              className="hover:text-[color:var(--accent-red)]"
            >
              {report.lead?.company_name ?? "—"}
            </Link>
          ) : (
            report.lead?.company_name ?? "—"
          )}
        </div>
        {name && <div className="text-xs text-[color:var(--text-secondary)]">{name}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="ma-label">Vertical</div>
          <div className="text-white mt-1">{report.vertical ?? "—"}</div>
        </div>
        <div>
          <div className="ma-label">Tier</div>
          <div className="text-white mt-1">{report.pricing_tier ?? "—"}</div>
        </div>
        <div>
          <div className="ma-label">Value</div>
          <div className="text-white mt-1 font-mono">
            ${Math.round(Number(report.pricing_value ?? 0)).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="ma-label">Hours saved</div>
          <div className="text-white mt-1 font-mono">{report.hours_saved_estimate ?? "—"}</div>
        </div>
      </div>

      {report.diagnosis_summary && (
        <div>
          <div className="ma-label">Diagnosis</div>
          <div className="text-xs text-white mt-1 whitespace-pre-wrap line-clamp-6">
            {report.diagnosis_summary}
          </div>
        </div>
      )}

      <JsonBlock label="ROI summary" value={report.roi_summary} />
      <JsonBlock label="Recommended stack" value={report.recommended_stack} />

      <div className="border-t border-[color:var(--border)] pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="ma-label">QC status</div>
          <QcBadge status={report.qc_status} />
        </div>
        {report.qc_status !== "approved" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={() => approveMutation.mutate(true)}
              disabled={approveMutation.isPending}
            >
              <CheckCircle2 size={14} /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => approveMutation.mutate(false)}
              disabled={approveMutation.isPending}
            >
              <XCircle size={14} /> Reject
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-[color:var(--border)] pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="ma-label">Delivery</div>
          {report.sent_at && (
            <span className="text-[10px] font-mono text-[color:var(--text-secondary)]">
              sent {new Date(report.sent_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => sendMutation.mutate()}
            disabled={!canSend || sendMutation.isPending || !!report.sent_at}
            title={!canSend ? "QC approval required before sending" : undefined}
          >
            <Send size={14} /> {report.sent_at ? "Sent" : "Send"}
          </Button>
          {report.pdf_url && (
            <a
              href={report.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-[color:var(--border)] rounded hover:bg-[color:var(--surface-2)] text-white"
            >
              <ExternalLink size={12} /> PDF
            </a>
          )}
        </div>
        {!canSend && (
          <div className="text-[11px] text-[color:var(--accent-red)] flex items-center gap-1">
            <AlertTriangle size={11} /> Send blocked until QC approved.
          </div>
        )}
      </div>

      <div className="border-t border-[color:var(--border)] pt-4">
        <div className="ma-label mb-2">QC audit trail</div>
        {qcRecordsQ.isLoading ? (
          <div className="text-xs text-[color:var(--text-secondary)]">Loading…</div>
        ) : (qcRecordsQ.data ?? []).length === 0 ? (
          <div className="text-xs text-[color:var(--text-secondary)]">No QC records yet.</div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-auto">
            {(qcRecordsQ.data ?? []).map((q) => (
              <div key={q.id} className="text-xs border border-[color:var(--border)] rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[color:var(--text-secondary)]">{q.qc_id ?? q.id.slice(0, 8)}</span>
                  <QcBadge status={q.qc_status} />
                </div>
                <div className="text-[11px] text-[color:var(--text-secondary)] mt-1">
                  {q.agent_reviewed ?? "—"} · {q.source ?? "manual"} ·{" "}
                  {new Date(q.reviewed_at ?? q.created_at).toLocaleString()}
                </div>
                {q.notes && <div className="text-[11px] text-white mt-1">{q.notes}</div>}
                {Array.isArray(q.issues_found) && q.issues_found.length > 0 && (
                  <div className="text-[11px] text-[color:var(--accent-red)] mt-1">
                    {q.issues_found.length} issue(s) flagged
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QcBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "PENDING", cls: "text-[color:var(--accent-orange)] border-[color:var(--accent-orange)]" },
    approved: { label: "APPROVED", cls: "text-[color:var(--accent-green)] border-[color:var(--accent-green)]" },
    rejected: { label: "REJECTED", cls: "text-[color:var(--accent-red)] border-[color:var(--accent-red)]" },
  };
  const s = status ?? "none";
  const cfg = map[s] ?? { label: "—", cls: "text-[color:var(--text-secondary)] border-[color:var(--border)]" };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  accent?: boolean;
}) {
  return (
    <div className="ma-panel p-5 relative overflow-hidden">
      {accent && <div className="absolute top-0 left-0 right-0 ma-accent-bar" />}
      <div className="flex items-center justify-between">
        <div className="ma-label">{label}</div>
        <Icon size={14} className="text-[color:var(--text-secondary)]" />
      </div>
      <div className="ma-metric text-3xl mt-3">{value}</div>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: any }) {
  if (!value || (typeof value === "object" && Object.keys(value).length === 0)) return null;
  return (
    <div>
      <div className="ma-label">{label}</div>
      <pre className="text-[10px] text-white mt-1 bg-[color:var(--surface-2)] rounded p-2 overflow-auto max-h-[140px] font-mono">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
