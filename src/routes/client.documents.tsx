import { createFileRoute } from "@tanstack/react-router";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/client/documents")({
  head: () => ({ meta: [{ title: "Documents — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="PORTAL / DOCUMENTS">
        <ModuleStub title="Documents" description="Contracts, reports, and shared files" />
      </ClientShell>
    </ClientGuard>
  ),
});
