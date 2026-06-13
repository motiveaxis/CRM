import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/admin/team")({
  head: () => ({ meta: [{ title: "Team — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / TEAM">
        <ModuleStub title="Team" description="Employees, roles, granular permissions" />
      </AdminShell>
    </StaffGuard>
  ),
});
