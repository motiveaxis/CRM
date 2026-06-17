import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/team")({
  head: () => ({ meta: [{ title: "Team — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / TEAM">
        <TeamPage />
      </AdminShell>
    </StaffGuard>
  ),
});

type AppRole = "admin" | "manager" | "employee" | "client_owner" | "client_viewer";
const STAFF_ROLES: AppRole[] = ["admin", "manager", "employee"];

interface EmployeeRow {
  id: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  status: string | null;
  permissions: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface RoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

interface DealRow {
  id: string;
  assigned_to: string | null;
  stage: string;
  deal_value: number | null;
}

interface LeadRow {
  id: string;
  assigned_to: string | null;
  status: string | null;
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="ma-panel p-4">
      <div className="ma-label">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-[color:var(--text-muted)] mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "active";
  const color =
    s === "active"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : s === "inactive"
      ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
      : "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return (
    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${color}`}>{s}</span>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-xs text-[color:var(--text-muted)]">—</span>;
  return (
    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-[color:var(--border)] bg-[color:var(--surface-2)]">
      {role}
    </span>
  );
}

function TeamPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const { data: employees = [], isLoading } = useQuery<EmployeeRow[]>({
    queryKey: ["team-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, auth_user_id, name, email, role, department, status, permissions, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EmployeeRow[];
    },
  });

  const { data: userRoles = [] } = useQuery<RoleRow[]>({
    queryKey: ["team-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id, user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const { data: deals = [] } = useQuery<DealRow[]>({
    queryKey: ["team-deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("id, assigned_to, stage, deal_value");
      if (error) throw error;
      return (data ?? []) as DealRow[];
    },
  });

  const { data: leads = [] } = useQuery<LeadRow[]>({
    queryKey: ["team-leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("id, assigned_to, status");
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const rolesByUser = useMemo(() => {
    const map = new Map<string, AppRole[]>();
    for (const r of userRoles) {
      const arr = map.get(r.user_id) ?? [];
      arr.push(r.role);
      map.set(r.user_id, arr);
    }
    return map;
  }, [userRoles]);

  const workloadByEmployee = useMemo(() => {
    const map = new Map<string, { openLeads: number; openDeals: number; pipeline: number }>();
    for (const e of employees) {
      map.set(e.id, { openLeads: 0, openDeals: 0, pipeline: 0 });
    }
    const WON = new Set(["closed_won"]);
    const LOST = new Set(["closed_lost"]);
    for (const d of deals) {
      if (!d.assigned_to) continue;
      const row = map.get(d.assigned_to);
      if (!row) continue;
      if (!WON.has(d.stage) && !LOST.has(d.stage)) {
        row.openDeals += 1;
        row.pipeline += d.deal_value ?? 0;
      }
    }
    for (const l of leads) {
      if (!l.assigned_to) continue;
      const row = map.get(l.assigned_to);
      if (!row) continue;
      if (l.status !== "closed" && l.status !== "lost" && l.status !== "won") {
        row.openLeads += 1;
      }
    }
    return map;
  }, [employees, deals, leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q) ||
        (e.role ?? "").toLowerCase().includes(q),
    );
  }, [employees, search]);

  const selected = useMemo(
    () => employees.find((e) => e.id === selectedId) ?? null,
    [employees, selectedId],
  );

  const metrics = useMemo(() => {
    const active = employees.filter((e) => (e.status ?? "active") === "active").length;
    const admins = userRoles.filter((r) => r.role === "admin").length;
    const linked = employees.filter((e) => e.auth_user_id).length;
    const unlinked = employees.length - linked;
    return { total: employees.length, active, admins, unlinked };
  }, [employees, userRoles]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("employees").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-employees"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from("employees").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-employees"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grantAppRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-user-roles"] });
      toast.success("Permission granted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeAppRole = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-user-roles"] });
      toast.success("Permission revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="ma-label">Module 8</div>
          <h1 className="text-2xl font-semibold mt-1">Team</h1>
          <p className="text-sm text-[color:var(--text-secondary)] mt-1">
            Employees, roles, and granular permissions.
          </p>
        </div>
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="px-3 py-2 text-xs font-mono uppercase border border-[color:var(--border)] bg-[color:var(--surface-2)] hover:bg-[color:var(--surface)] rounded"
        >
          {showInvite ? "Cancel" : "+ Add employee"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Metric label="Total" value={metrics.total} />
        <Metric label="Active" value={metrics.active} />
        <Metric label="Admins" value={metrics.admins} />
        <Metric label="Without portal access" value={metrics.unlinked} sub="auth_user_id missing" />
      </div>

      {showInvite && (
        <InviteEmployee
          onClose={() => setShowInvite(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["team-employees"] });
            setShowInvite(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        <div className="ma-panel">
          <div className="p-4 border-b border-[color:var(--border)] flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, role, department"
              className="flex-1 bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[color:var(--accent-red)]"
            />
            <div className="text-xs text-[color:var(--text-muted)] font-mono">
              {filtered.length} / {employees.length}
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase font-mono text-[color:var(--text-muted)] border-b border-[color:var(--border)]">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Dept</th>
                  <th className="px-4 py-2">Workload</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-[color:var(--text-muted)]">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-[color:var(--text-muted)]">No employees</td></tr>
                )}
                {filtered.map((e) => {
                  const w = workloadByEmployee.get(e.id);
                  const active = selectedId === e.id;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`border-b border-[color:var(--border)] cursor-pointer hover:bg-[color:var(--surface-2)] ${
                        active ? "bg-[color:var(--surface-2)]" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-[color:var(--text-muted)]">{e.email}</div>
                      </td>
                      <td className="px-4 py-2.5"><RoleBadge role={e.role} /></td>
                      <td className="px-4 py-2.5 text-[color:var(--text-secondary)]">{e.department ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-[color:var(--text-secondary)]">
                        {w ? `${w.openLeads}L / ${w.openDeals}D` : "—"}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ma-panel p-4">
          {!selected ? (
            <div className="text-sm text-[color:var(--text-muted)] py-10 text-center">
              Select an employee to manage roles & permissions
            </div>
          ) : (
            <EmployeeDetail
              employee={selected}
              roles={selected.auth_user_id ? rolesByUser.get(selected.auth_user_id) ?? [] : []}
              userRoleRows={userRoles.filter((r) => r.user_id === selected.auth_user_id)}
              workload={workloadByEmployee.get(selected.id)}
              onChangeStatus={(status) => updateStatus.mutate({ id: selected.id, status })}
              onChangeRole={(role) => updateRole.mutate({ id: selected.id, role })}
              onGrant={(role) => {
                if (!selected.auth_user_id) {
                  toast.error("Employee has no linked auth user");
                  return;
                }
                grantAppRole.mutate({ userId: selected.auth_user_id, role });
              }}
              onRevoke={(id) => revokeAppRole.mutate({ id })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeDetail({
  employee,
  roles,
  userRoleRows,
  workload,
  onChangeStatus,
  onChangeRole,
  onGrant,
  onRevoke,
}: {
  employee: EmployeeRow;
  roles: AppRole[];
  userRoleRows: RoleRow[];
  workload?: { openLeads: number; openDeals: number; pipeline: number };
  onChangeStatus: (s: string) => void;
  onChangeRole: (r: string) => void;
  onGrant: (r: AppRole) => void;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="ma-label">Employee</div>
        <div className="text-lg font-semibold mt-1">{employee.name}</div>
        <div className="text-xs text-[color:var(--text-muted)] font-mono">{employee.email}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Department">{employee.department ?? "—"}</Field>
        <Field label="Created">{new Date(employee.created_at).toLocaleDateString()}</Field>
        <Field label="Open leads">{workload?.openLeads ?? 0}</Field>
        <Field label="Open deals">{workload?.openDeals ?? 0}</Field>
      </div>

      <div>
        <div className="ma-label mb-2">Profile role</div>
        <select
          value={employee.role ?? ""}
          onChange={(e) => onChangeRole(e.target.value)}
          className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-3 py-1.5 text-sm"
        >
          <option value="">— none —</option>
          <option value="admin">admin</option>
          <option value="manager">manager</option>
          <option value="sales">sales</option>
          <option value="ops">ops</option>
          <option value="engineer">engineer</option>
          <option value="support">support</option>
        </select>
      </div>

      <div>
        <div className="ma-label mb-2">Status</div>
        <div className="flex gap-1">
          {["active", "inactive", "suspended"].map((s) => (
            <button
              key={s}
              onClick={() => onChangeStatus(s)}
              className={`px-3 py-1 text-xs font-mono uppercase rounded border ${
                (employee.status ?? "active") === s
                  ? "bg-[color:var(--accent-red)] text-white border-[color:var(--accent-red)]"
                  : "bg-[color:var(--surface-2)] border-[color:var(--border)] text-[color:var(--text-secondary)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="ma-label mb-2">App permissions (user_roles)</div>
        {!employee.auth_user_id ? (
          <div className="text-xs text-amber-400">
            No auth_user_id linked — user has not signed in yet, so permissions cannot be granted.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {userRoleRows.length === 0 && (
                <span className="text-xs text-[color:var(--text-muted)]">No app roles assigned</span>
              )}
              {userRoleRows.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-[color:var(--border)] bg-[color:var(--surface-2)]"
                >
                  {r.role}
                  <button
                    onClick={() => onRevoke(r.id)}
                    className="text-[color:var(--text-muted)] hover:text-[color:var(--accent-red)]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STAFF_ROLES.filter((r) => !roles.includes(r)).map((r) => (
                <button
                  key={r}
                  onClick={() => onGrant(r)}
                  className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-dashed border-[color:var(--border)] hover:border-[color:var(--accent-red)] hover:text-white text-[color:var(--text-secondary)]"
                >
                  + {r}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
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

function InviteEmployee({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("employees").insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      department: department.trim() || null,
      status: "active",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Employee added. They'll be linked on first sign-in.");
    onCreated();
  }

  return (
    <form onSubmit={submit} className="ma-panel p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
      <div className="md:col-span-1">
        <div className="ma-label mb-1">Name</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-2 py-1.5 text-sm"
        />
      </div>
      <div className="md:col-span-2">
        <div className="ma-label mb-1">Email</div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <div className="ma-label mb-1">Role</div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-2 py-1.5 text-sm"
        >
          <option value="admin">admin</option>
          <option value="manager">manager</option>
          <option value="sales">sales</option>
          <option value="ops">ops</option>
          <option value="engineer">engineer</option>
          <option value="support">support</option>
          <option value="employee">employee</option>
        </select>
      </div>
      <div>
        <div className="ma-label mb-1">Department</div>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded px-2 py-1.5 text-sm"
        />
      </div>
      <div className="md:col-span-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-mono uppercase border border-[color:var(--border)] rounded"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-1.5 text-xs font-mono uppercase bg-[color:var(--accent-red)] text-white rounded disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create"}
        </button>
      </div>
    </form>
  );
}
