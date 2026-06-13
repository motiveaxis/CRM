import { createFileRoute } from "@tanstack/react-router";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/client/support")({
  head: () => ({ meta: [{ title: "Support — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="PORTAL / SUPPORT">
        <ModuleStub title="Support" description="Open tickets and request history" />
      </ClientShell>
    </ClientGuard>
  ),
});
