import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/admin/sales")({
  head: () => ({ meta: [{ title: "Sales — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / SALES">
        <ModuleStub title="Sales" description="Closed deals, revenue, and forecast" />
      </AdminShell>
    </StaffGuard>
  ),
});
