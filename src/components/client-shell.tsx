import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, Workflow, BarChart3, LifeBuoy, FileText, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

const NAV = [
  { to: "/client/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/client/automations", label: "Automations", icon: Workflow },
  { to: "/client/api-usage", label: "API Usage", icon: BarChart3 },
  { to: "/client/support", label: "Support", icon: LifeBuoy },
  { to: "/client/documents", label: "Documents", icon: FileText },
] as const;

export function ClientShell({ children, breadcrumb }: { children: ReactNode; breadcrumb: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/client/login", replace: true });
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-[220px] shrink-0 bg-[color:var(--surface)] border-r border-[color:var(--border)] flex flex-col">
        <div className="px-5 py-5 border-b border-[color:var(--border)]">
          <div className="flex items-center gap-2">
            <div className="ma-status-dot" />
            <span className="font-bold tracking-tight">MotiveAxis</span>
          </div>
          <div className="ma-label mt-1">Client Portal</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? "text-white bg-[color:var(--surface-2)]"
                    : "text-[color:var(--text-secondary)] hover:text-white hover:bg-[color:var(--surface-2)]"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[color:var(--accent-red)]" />
                )}
                <Icon size={15} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-[color:var(--border)]">
          <div className="ma-label">Signed in</div>
          <div className="text-xs font-mono text-white truncate mt-1">{user?.email}</div>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-xs text-[color:var(--text-secondary)] hover:text-white"
          >
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <header className="h-12 border-b border-[color:var(--border)] flex items-center px-6">
          <div className="ma-label">{breadcrumb}</div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
