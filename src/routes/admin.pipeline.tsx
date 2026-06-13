import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/admin/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / PIPELINE">
        <ModuleStub title="Pipeline" description="Kanban + list view of active deals" />
      </AdminShell>
    </StaffGuard>
  ),
});
