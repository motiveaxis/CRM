import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/admin/clients")({
  head: () => ({ meta: [{ title: "Clients — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / CLIENTS">
        <ModuleStub title="Clients" description="Active client accounts and engagement state" />
      </AdminShell>
    </StaffGuard>
  ),
});
