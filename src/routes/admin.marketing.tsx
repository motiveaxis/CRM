import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, Target, DollarSign } from "lucide-react";

export const Route = createFileRoute("/admin/marketing")({
  head: () => ({ meta: [{ title: "Marketing — MotiveAxis CRM" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / MARKETING">
        <Marketing />
      </AdminShell>
    </StaffGuard>
  ),
});

interface LeadRow {
  id: string;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: string;
  created_at: string;
  vertical: string | null;
}

interface DealRow {
  id: string;
  lead_id: string | null;
  stage: string;
  deal_value: number | null;
}

const RANGES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: null as number | null },
];

async function fetchLeads(days: number | null): Promise<LeadRow[]> {
  let q = supabase
    .from("leads")
    .select("id,source,utm_source,utm_medium,utm_campaign,status,created_at,vertical");
  if (days != null) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    q = q.gte("created_at", since);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LeadRow[];
}

async function fetchDeals(): Promise<DealRow[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("id,lead_id,stage,deal_value");
  if (error) throw error;
  return (data ?? []) as DealRow[];
}

function Marketing() {
  const [rangeIdx, setRangeIdx] = useState(1);
  const range = RANGES[rangeIdx];

  const leadsQ = useQuery({
    queryKey: ["mkt-leads", range.days],
    queryFn: () => fetchLeads(range.days),
  });
  const dealsQ = useQuery({ queryKey: ["mkt-deals"], queryFn: fetchDeals });

  const leads = leadsQ.data ?? [];
  const deals = dealsQ.data ?? [];

  // Map: leadId -> deal stage/value (most recent)
  const dealByLead = useMemo(() => {
    const m = new Map<string, DealRow>();
    for (const d of deals) if (d.lead_id) m.set(d.lead_id, d);
    return m;
  }, [deals]);

  const totals = useMemo(() => {
    const totalLeads = leads.length;
    const qualified = leads.filter((l) =>
      ["qualified", "report_sent", "negotiation", "closed_won"].includes(l.status),
    ).length;
    let won = 0;
    let revenue = 0;
    for (const l of leads) {
      const d = dealByLead.get(l.id);
      if (d?.stage === "closed_won") {
        won += 1;
        revenue += Number(d.deal_value ?? 0);
      }
    }
    const conv = totalLeads ? (won / totalLeads) * 100 : 0;
    return { totalLeads, qualified, won, revenue, conv };
  }, [leads, dealByLead]);

  const bySource = useMemo(() => groupBy(leads, (l) => l.source ?? "unknown", dealByLead), [leads, dealByLead]);
  const byUtmSource = useMemo(
    () => groupBy(leads.filter((l) => l.utm_source), (l) => l.utm_source ?? "—", dealByLead),
    [leads, dealByLead],
  );
  const byCampaign = useMemo(
    () => groupBy(leads.filter((l) => l.utm_campaign), (l) => l.utm_campaign ?? "—", dealByLead),
    [leads, dealByLead],
  );
  const byVertical = useMemo(
    () => groupBy(leads.filter((l) => l.vertical), (l) => l.vertical ?? "—", dealByLead),
    [leads, dealByLead],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1>Marketing</h1>
          <div className="ma-label mt-2">Channel performance · UTM attribution · conversion</div>
        </div>
        <div className="flex items-center gap-1 border border-[color:var(--border)] rounded-md p-0.5">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={`px-3 py-1 text-xs rounded ${
                i === rangeIdx
                  ? "bg-[color:var(--surface-2)] text-white"
                  : "text-[color:var(--text-secondary)] hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Leads in" value={totals.totalLeads.toString()} sub={`Range: ${range.label}`} />
        <MetricCard icon={Target} label="Qualified" value={totals.qualified.toString()} sub={`${pct(totals.qualified, totals.totalLeads)} of leads`} />
        <MetricCard icon={TrendingUp} label="Conversion" value={`${totals.conv.toFixed(1)}%`} sub={`${totals.won} closed won`} />
        <MetricCard icon={DollarSign} label="Attributed revenue" value={`$${Math.round(totals.revenue).toLocaleString()}`} sub="From won deals" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChannelTable title="Lead source" rows={bySource} />
        <ChannelTable title="UTM source" rows={byUtmSource} emptyHint="No UTM-tagged leads in range." />
        <ChannelTable title="Campaign" rows={byCampaign} emptyHint="No campaign-tagged leads in range." />
        <ChannelTable title="Vertical" rows={byVertical} emptyHint="No vertical assigned." />
      </div>

      <div className="ma-panel p-5">
        <div className="ma-label mb-3">Recent UTM-tagged leads</div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-[color:var(--text-secondary)] text-xs uppercase tracking-wider">
              <tr className="text-left">
                <th className="py-2 pr-3">Lead</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Medium</th>
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads
                .filter((l) => l.utm_source || l.utm_campaign)
                .slice(0, 12)
                .map((l) => (
                  <tr key={l.id} className="border-t border-[color:var(--border)]">
                    <td className="py-2 pr-3">
                      <Link
                        to="/admin/leads/$leadId"
                        params={{ leadId: l.id }}
                        className="text-white hover:text-[color:var(--accent-red)]"
                      >
                        {l.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.utm_source ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.utm_medium ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.utm_campaign ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">{l.status}</td>
                    <td className="py-2 pr-3 text-xs text-[color:var(--text-secondary)]">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              {leads.filter((l) => l.utm_source || l.utm_campaign).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[color:var(--text-secondary)] text-sm">
                    No UTM-tagged leads in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface ChannelRow {
  key: string;
  leads: number;
  qualified: number;
  won: number;
  revenue: number;
}

function groupBy(
  leads: LeadRow[],
  keyFn: (l: LeadRow) => string,
  dealByLead: Map<string, DealRow>,
): ChannelRow[] {
  const m = new Map<string, ChannelRow>();
  for (const l of leads) {
    const k = keyFn(l);
    const row = m.get(k) ?? { key: k, leads: 0, qualified: 0, won: 0, revenue: 0 };
    row.leads += 1;
    if (["qualified", "report_sent", "negotiation", "closed_won"].includes(l.status)) row.qualified += 1;
    const d = dealByLead.get(l.id);
    if (d?.stage === "closed_won") {
      row.won += 1;
      row.revenue += Number(d.deal_value ?? 0);
    }
    m.set(k, row);
  }
  return Array.from(m.values()).sort((a, b) => b.leads - a.leads);
}

function ChannelTable({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: ChannelRow[];
  emptyHint?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.leads));
  return (
    <div className="ma-panel p-5">
      <div className="ma-label mb-3">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-[color:var(--text-secondary)] py-4">{emptyHint ?? "No data."}</div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 8).map((r) => (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white truncate pr-3">{r.key}</span>
                <span className="font-mono text-[color:var(--text-secondary)] shrink-0">
                  {r.leads} · {r.won}w · ${Math.round(r.revenue).toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-[color:var(--surface-2)] rounded overflow-hidden">
                <div
                  className="h-full bg-[color:var(--accent-red)]"
                  style={{ width: `${(r.leads / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="ma-panel p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 ma-accent-bar" />
      <div className="flex items-center justify-between">
        <div className="ma-label">{label}</div>
        <Icon size={14} className="text-[color:var(--text-secondary)]" />
      </div>
      <div className="ma-metric text-3xl mt-3">{value}</div>
      <div className="text-[11px] text-[color:var(--text-secondary)] mt-2">{sub}</div>
    </div>
  );
}

function pct(n: number, d: number) {
  if (!d) return "0%";
  return `${((n / d) * 100).toFixed(0)}%`;
}
