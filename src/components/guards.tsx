import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";

function LoadingShell() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="ma-label">Loading session…</div>
    </div>
  );
}

export function StaffGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const { isStaff, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!user) navigate({ to: "/admin/login", replace: true });
    else if (!isStaff) navigate({ to: "/client/dashboard", replace: true });
  }, [user, isStaff, loading, roleLoading, navigate]);

  if (loading || roleLoading || !user || !isStaff) return <LoadingShell />;
  return <>{children}</>;
}

export function ClientGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();
  const { isStaff, loading: roleLoading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || roleLoading) return;
    if (!user) navigate({ to: "/client/login", replace: true });
    // Staff can also view client portal screens via /admin/portals action, so allow.
  }, [user, loading, roleLoading, navigate]);

  if (loading || roleLoading || !user) return <LoadingShell />;
  return <>{children}</>;
}
