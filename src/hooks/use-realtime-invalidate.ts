import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Sub = {
  table: string;
  queryKeys: (string | undefined | null)[][];
  filter?: string;
};

/**
 * Subscribe to postgres_changes on one or more tables and invalidate the
 * matching React Query cache keys when rows change. Mount inside a
 * component; cleans up on unmount.
 */
export function useRealtimeInvalidate(channelName: string, subs: Sub[]) {
  const qc = useQueryClient();

  useEffect(() => {
    if (subs.length === 0) return;
    const channel = supabase.channel(channelName);
    for (const s of subs) {
      channel.on(
        "postgres_changes",
        // @ts-expect-error supabase-js typing for postgres_changes filter is loose
        { event: "*", schema: "public", table: s.table, filter: s.filter },
        () => {
          for (const key of s.queryKeys) {
            const cleaned = key.filter((k): k is string => !!k);
            if (cleaned.length) qc.invalidateQueries({ queryKey: cleaned });
          }
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, JSON.stringify(subs), qc]);
}
