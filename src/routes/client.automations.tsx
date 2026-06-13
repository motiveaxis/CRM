import { createFileRoute } from "@tanstack/react-router";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/client/automations")({
  head: () => ({ meta: [{ title: "Automations — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="PORTAL / AUTOMATIONS">
        <ModuleStub title="Automations" description="Your active workflows and time saved" />
      </ClientShell>
    </ClientGuard>
  ),
});
