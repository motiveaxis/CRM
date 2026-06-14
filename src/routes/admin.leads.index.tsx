import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Download, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/admin/leads/")({
  head: () => ({ meta: [{ title: "Leads — MotiveAxis CRM" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / LEADS">
        <LeadsList />
      </AdminShell>
    </StaffGuard>
  ),
});

interface Lead {
  id: string;
  lead_id: string;
  company_name: string;
  first_name: string;
  last_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  source: string | null;
  vertical: string | null;
  priority: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ["new", "contacted", "qualified", "report_sent", "negotiation", "closed_won", "closed_lost"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const SOURCE_OPTIONS = ["website", "referral", "outbound", "linkedin", "event", "other"];

const PAGE_SIZE = 20;

function LeadsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created_at" | "company_name" | "priority">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["leads", { search, statusFilter, priorityFilter, sortBy, sortDir, page }],
    queryFn: async () => {
      let q = supabase
        .from("leads")
        .select("id, lead_id, company_name, contact_name, email, phone, source, vertical, priority, status, created_at", { count: "exact" });

      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (priorityFilter !== "all") q = q.eq("priority", priorityFilter);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`company_name.ilike.${s},contact_name.ilike.${s},email.ilike.${s},lead_id.ilike.${s}`);
      }
      q = q.order(sortBy, { ascending: sortDir === "asc" });
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Lead[], count: count ?? 0 };
    },
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  function exportCsv() {
    const rows = data?.rows ?? [];
    const headers = ["lead_id", "company_name", "contact_name", "email", "phone", "source", "vertical", "priority", "status", "created_at"];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers.map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `motiveaxis-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1>Leads</h1>
          <div className="ma-label mt-2">Intake queue — {data?.count ?? 0} total records</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[color:var(--accent-red)] hover:bg-[color:var(--accent-red)]/90">
                <Plus size={14} /> New lead
              </Button>
            </DialogTrigger>
            <NewLeadDialog onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["leads"] }); }} />
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="ma-panel p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <Label className="ma-label">Search</Label>
          <Input
            placeholder="Company, contact, email, lead ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]"
          />
        </div>
        <div>
          <Label className="ma-label">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="ma-label">Priority</Label>
          <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0); }}>
            <SelectTrigger className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="ma-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]">
              <tr className="text-left">
                <Th onClick={() => toggleSort("company_name")} active={sortBy === "company_name"}>Lead ID / Company</Th>
                <th className="px-4 py-3 ma-label">Contact</th>
                <th className="px-4 py-3 ma-label">Source</th>
                <Th onClick={() => toggleSort("priority")} active={sortBy === "priority"}>Priority</Th>
                <th className="px-4 py-3 ma-label">Status</th>
                <Th onClick={() => toggleSort("created_at")} active={sortBy === "created_at"}>Created</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--text-secondary)]">Loading…</td></tr>
              )}
              {!isLoading && (data?.rows.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--text-secondary)]">No leads match these filters.</td></tr>
              )}
              {data?.rows.map((l) => (
                <tr key={l.id} className="border-t border-[color:var(--border)] hover:bg-[color:var(--surface-2)]/50">
                  <td className="px-4 py-3">
                    <Link
                      to="/admin/leads/$leadId"
                      params={{ leadId: l.id }}
                      className="block"
                    >
                      <div className="font-mono text-[11px] text-[color:var(--text-secondary)]">{l.lead_id}</div>
                      <div className="font-medium text-white">{l.company_name}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{l.contact_name}</div>
                    <div className="text-[11px] text-[color:var(--text-secondary)]">{l.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--text-secondary)]">{l.source ?? "—"}</td>
                  <td className="px-4 py-3"><PriorityPill priority={l.priority} /></td>
                  <td className="px-4 py-3"><StatusPill status={l.status} /></td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[color:var(--text-secondary)]">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[color:var(--border)] text-xs">
          <div className="text-[color:var(--text-secondary)]">
            Page {page + 1} of {totalPages} · {PAGE_SIZE} per page
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={14} /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active: boolean }) {
  return (
    <th className="px-4 py-3">
      <button onClick={onClick} className={`ma-label inline-flex items-center gap-1 ${active ? "text-white" : ""}`}>
        {children} <ArrowUpDown size={11} />
      </button>
    </th>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[color:var(--border)] bg-[color:var(--surface-2)] text-white">
      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent-red)]" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-[color:var(--text-secondary)]">—</span>;
  const colorMap: Record<string, string> = {
    urgent: "var(--accent-red)",
    high: "oklch(0.7 0.15 22)",
    medium: "oklch(0.62 0.005 285)",
    low: "var(--text-muted)",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-white">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colorMap[priority] ?? "var(--text-muted)" }} />
      {priority}
    </span>
  );
}

function NewLeadDialog({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    source: "website",
    vertical: "",
    priority: "medium",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").insert({
        lead_id: "",
        company_name: form.company_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone || null,
        source: form.source,
        vertical: form.vertical || null,
        priority: form.priority,
        notes: form.notes || null,
        status: "new",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead created");
      onCreated();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create lead"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name || !form.contact_name || !form.email) {
      toast.error("Company, contact, and email are required");
      return;
    }
    mutation.mutate();
  }

  return (
    <DialogContent className="bg-[color:var(--surface)] border-[color:var(--border)] max-w-xl">
      <DialogHeader>
        <DialogTitle>New lead</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company *" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} />
          <Field label="Contact *" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} />
          <Field label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Vertical" value={form.vertical} onChange={(v) => setForm({ ...form, vertical: v })} />
          <div>
            <Label className="ma-label">Source</Label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="ma-label">Priority</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="ma-label">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending} className="bg-[color:var(--accent-red)] hover:bg-[color:var(--accent-red)]/90">
            {mutation.isPending ? "Creating…" : "Create lead"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="ma-label">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 bg-[color:var(--surface-2)] border-[color:var(--border)]"
      />
    </div>
  );
}
