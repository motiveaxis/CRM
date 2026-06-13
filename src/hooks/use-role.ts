import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

export type AppRole = "admin" | "manager" | "employee" | "client_owner" | "client_viewer";

export interface RoleState {
  loading: boolean;
  roles: AppRole[];
  isStaff: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isClient: boolean;
}

export function useRole(): RoleState {
  const { user, loading: sessionLoading } = useSession();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (sessionLoading) return;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[useRole] failed to load roles:", error.message);
          setRoles([]);
        } else {
          setRoles((data ?? []).map((r) => r.role as AppRole));
        }
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [user, sessionLoading]);

  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const isStaff = isAdmin || isManager || roles.includes("employee");
  const isClient = roles.includes("client_owner") || roles.includes("client_viewer");

  return { loading: sessionLoading || loading, roles, isStaff, isAdmin, isManager, isClient };
}
