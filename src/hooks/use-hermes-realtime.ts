import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

/**
 * Subscribes to Hermes-driven tables (leads, reports, interactions, qc_records)
 * and invalidates the relevant React Query caches when agents write.
 * Mount once near the root.
 */
export function useHermesRealtime(queryClient: QueryClient) {
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("hermes-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload: any) => {
          const id = payload.new?.id;
          if (id) queryClient.invalidateQueries({ queryKey: ["lead", id] });
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["reports"] });
          const leadId = payload.new?.lead_id ?? payload.old?.lead_id;
          if (leadId) queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "interactions" },
        (payload: any) => {
          const leadId = payload.new?.lead_id;
          if (leadId) queryClient.invalidateQueries({ queryKey: ["interactions", leadId] });
          if (payload.new?.type === "conversion_signal" || payload.new?.requires_human_review) {
            toast.error("• HUMAN REVIEW REQUIRED", {
              description: payload.new?.content_summary ?? "Conversion signal detected by Sales-Axis.",
              duration: 15000,
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "qc_records" },
        (payload: any) => {
          const reportId = payload.new?.report_id;
          const leadId = payload.new?.lead_id;
          if (reportId) queryClient.invalidateQueries({ queryKey: ["report", reportId] });
          if (leadId) queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
