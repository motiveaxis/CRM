import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MotiveAxis" },
      { name: "description", content: "Operational CRM and client automation portal." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useSession();
  const { isStaff, isClient, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!user) return;
    if (isStaff) navigate({ to: "/admin/dashboard", replace: true });
    else if (isClient) navigate({ to: "/client/dashboard", replace: true });
  }, [user, isStaff, isClient, loading, roleLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="ma-panel w-full max-w-2xl p-10">
        <div className="ma-accent-bar mb-8" />
        <div className="ma-label mb-3">MotiveAxis / System</div>
        <h1 className="mb-6">Automation Operations Platform</h1>
        <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed mb-10 max-w-lg">
          Internal CRM for the MotiveAxis team and secure portal for converted clients.
          Authentication required to proceed.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link
            to="/admin/login"
            className="border border-[color:var(--border)] hover:border-[color:var(--accent-red)] transition-colors p-5 group"
          >
            <div className="ma-label mb-2">Internal</div>
            <div className="text-base font-semibold mb-1">Admin CRM</div>
            <div className="text-xs text-[color:var(--text-secondary)]">
              Leads, pipeline, sales, clients, team →
            </div>
          </Link>
          <Link
            to="/client/login"
            className="border border-[color:var(--border)] hover:border-[color:var(--accent-red)] transition-colors p-5 group"
          >
            <div className="ma-label mb-2">External</div>
            <div className="text-base font-semibold mb-1">Client Portal</div>
            <div className="text-xs text-[color:var(--text-secondary)]">
              Automations, API usage, support →
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
