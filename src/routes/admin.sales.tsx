import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/sales")({
  head: () => ({ meta: [{ title: "Sales — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / SALES">
        <SalesPage />
      </AdminShell>
    </StaffGuard>
  ),
});

const RANGES = [
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "ytd", label: "YTD", days: 0 },
  { key: "all", label: "All", days: null as number | null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

interface DealRow {
  id: string;
  deal_id: string;
  lead_id: string;
  stage: string;
  deal_value: number | null;
  close_probability: number | null;
  pricing_tier: string | null;
  contract_status: string;
  contract_signed_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
    vertical: string | null;
  } | null;
  employee?: { name: string | null } | null;
}

const WON_STAGES = new Set(["closed_won", "won"]);
const LOST_STAGES = new Set(["closed_lost", "lost"]);

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function rangeStart(key: RangeKey): Date | null {
  const r = RANGES.find((x) => x.key === key)!;
  if (r.days === null) return null;
  if (key === "ytd") return new Date(new Date().getFullYear(), 0, 1);
  const d = new Date();
  d.setDate(d.getDate() - (r.days ?? 0));
  return d;
}

function SalesPage() {
  const [range, setRange] = useState<RangeKey>("90d");

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["sales-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select(
          "id, deal_id, lead_id, stage, deal_value, close_probability, pricing_tier, contract_status, contract_signed_at, assigned_to, created_at, updated_at, lead:leads(company_name,first_name,last_name,vertical), employee:employees!deals_assigned_to_fkey(name)",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DealRow[];
    },
  });

  const startDate = rangeStart(range);

  const inRange = useMemo(() => {
    if (!startDate) return deals;
    return deals.filter((d) => new Date(d.updated_at) >= startDate);
  }, [deals, startDate]);

  const metrics = useMemo(() => {
    const won = inRange.filter((d) => WON_STAGES.has(d.stage));
    const lost = inRange.filter((d) => LOST_STAGES.has(d.stage));
    const open = inRange.filter((d) => !WON_STAGES.has(d.stage) && !LOST_STAGES.has(d.stage));
    const revenue = won.reduce((s, d) => s + (d.deal_value ?? 0), 0);
    const pipeline = open.reduce((s, d) => s + (d.deal_value ?? 0), 0);
    const weighted = open.reduce(
      (s, d) => s + (d.deal_value ?? 0) * ((d.close_probability ?? 0) / 100),
      0,
    );
    const decided = won.length + lost.length;
    const winRate = decided ? (won.length / decided) * 100 : 0;
    const avg = won.length ? revenue / won.length : 0;
    return { won, lost, open, revenue, pipeline, weighted, winRate, avg };
  }, [inRange]);

  const byRep = useMemo(() => {
    const map = new Map<string, { name: string; won: number; revenue: number; open: number; pipeline: number }>();
    for (const d of inRange) {
      const key = d.assigned_to ?? "unassigned";
      const name = d.employee?.name ?? "Unassigned";
      const row = map.get(key) ?? { name, won: 0, revenue: 0, open: 0, pipeline: 0 };
      if (WON_STAGES.has(d.stage)) {
        row.won += 1;
        row.revenue += d.deal_value ?? 0;
      } else if (!LOST_STAGES.has(d.stage)) {
        row.open += 1;
        row.pipeline += d.deal_value ?? 0;
      }
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [inRange]);

  const recentWins = useMemo(
    () =>
      inRange
        .filter((d) => WON_STAGES.has(d.stage))
        .sort((a, b) => {
          const at = a.contract_signed_at ?? a.updated_at;
          const bt = b.contract_signed_at ?? b.updated_at;
          return new Date(bt).getTime() - new Date(at).getTime();
        })
        .slice(0, 10),
    [inRange],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="ma-label mt-1">Closed revenue, pipeline value, and rep performance</p>
        </div>
        <div className="flex gap-1 bg-[color:var(--surface)] border border-[color:var(--border)] rounded-md p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 text-xs rounded ${
                range === r.key
                  ? "bg-[color:var(--surface-2)] text-white"
                  : "text-[color:var(--text-secondary)] hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Metric label="Closed revenue" value={fmtMoney(metrics.revenue)} sub={`${metrics.won.length} won`} />
        <Metric label="Open pipeline" value={fmtMoney(metrics.pipeline)} sub={`${metrics.open.length} deals`} />
        <Metric label="Weighted forecast" value={fmtMoney(metrics.weighted)} sub="prob × value" />
        <Metric label="Win rate" value={`${metrics.winRate.toFixed(1)}%`} sub={`avg ${fmtMoney(metrics.avg)}`} />
      </div>

      <section className="ma-panel">
        <div className="px-5 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold">Rep performance</h2>
          <span className="ma-label">{byRep.length} reps</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-[color:var(--text-secondary)] uppercase">
            <tr className="border-b border-[color:var(--border)]">
              <th className="text-left px-5 py-2 font-medium">Rep</th>
              <th className="text-right px-5 py-2 font-medium">Won</th>
              <th className="text-right px-5 py-2 font-medium">Revenue</th>
              <th className="text-right px-5 py-2 font-medium">Open</th>
              <th className="text-right px-5 py-2 font-medium">Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {byRep.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-[color:var(--text-secondary)]">
                  No deals in this range
                </td>
              </tr>
            )}
            {byRep.map((r) => (
              <tr key={r.name} className="border-b border-[color:var(--border)] last:border-0">
                <td className="px-5 py-2 text-white">{r.name}</td>
                <td className="px-5 py-2 text-right font-mono">{r.won}</td>
                <td className="px-5 py-2 text-right font-mono">{fmtMoney(r.revenue)}</td>
                <td className="px-5 py-2 text-right font-mono">{r.open}</td>
                <td className="px-5 py-2 text-right font-mono text-[color:var(--text-secondary)]">
                  {fmtMoney(r.pipeline)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ma-panel">
        <div className="px-5 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent wins</h2>
          <span className="ma-label">{recentWins.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-[color:var(--text-secondary)] uppercase">
            <tr className="border-b border-[color:var(--border)]">
              <th className="text-left px-5 py-2 font-medium">Deal</th>
              <th className="text-left px-5 py-2 font-medium">Company</th>
              <th className="text-left px-5 py-2 font-medium">Vertical</th>
              <th className="text-left px-5 py-2 font-medium">Tier</th>
              <th className="text-right px-5 py-2 font-medium">Value</th>
              <th className="text-left px-5 py-2 font-medium">Signed</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-[color:var(--text-secondary)]">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && recentWins.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-[color:var(--text-secondary)]">
                  No wins in this range
                </td>
              </tr>
            )}
            {recentWins.map((d) => {
              const company =
                d.lead?.company_name ||
                [d.lead?.first_name, d.lead?.last_name].filter(Boolean).join(" ") ||
                "—";
              return (
                <tr key={d.id} className="border-b border-[color:var(--border)] last:border-0 hover:bg-[color:var(--surface-2)]">
                  <td className="px-5 py-2 font-mono text-xs">
                    <Link
                      to="/admin/leads/$leadId"
                      params={{ leadId: d.lead_id }}
                      className="text-white hover:underline"
                    >
                      {d.deal_id}
                    </Link>
                  </td>
                  <td className="px-5 py-2 text-white">{company}</td>
                  <td className="px-5 py-2 text-[color:var(--text-secondary)]">
                    {d.lead?.vertical ?? "—"}
                  </td>
                  <td className="px-5 py-2 text-[color:var(--text-secondary)]">
                    {d.pricing_tier ?? "—"}
                  </td>
                  <td className="px-5 py-2 text-right font-mono">{fmtMoney(d.deal_value ?? 0)}</td>
                  <td className="px-5 py-2 text-[color:var(--text-secondary)] text-xs">
                    {(d.contract_signed_at ?? d.updated_at).slice(0, 10)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ma-panel p-5">
      <div className="ma-label">{label}</div>
      <div className="text-2xl font-bold mt-2 text-white">{value}</div>
      {sub && <div className="text-xs text-[color:var(--text-secondary)] mt-1">{sub}</div>}
    </div>
  );
}
