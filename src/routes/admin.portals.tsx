import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/admin/portals")({
  head: () => ({ meta: [{ title: "Portals — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / PORTALS">
        <ModuleStub title="Portals" description="Client portal instances, n8n bindings, credential vault" />
      </AdminShell>
    </StaffGuard>
  ),
});
