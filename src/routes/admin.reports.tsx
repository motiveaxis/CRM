import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { StaffGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — MotiveAxis" }] }),
  component: () => (
    <StaffGuard>
      <AdminShell breadcrumb="ADMIN / REPORTS">
        <ModuleStub title="Reports" description="Generated decision narratives and stack recommendations" />
      </AdminShell>
    </StaffGuard>
  ),
});
