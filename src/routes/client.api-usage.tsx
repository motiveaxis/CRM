import { createFileRoute } from "@tanstack/react-router";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/client/api-usage")({
  head: () => ({ meta: [{ title: "API Usage — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="PORTAL / API USAGE">
        <ModuleStub title="API Usage" description="Per-API call volume and monthly cost" />
      </ClientShell>
    </ClientGuard>
  ),
});
