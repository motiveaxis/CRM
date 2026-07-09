import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // See docs/PERFORMANCE.md for the caching + preload strategy.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays "fresh" for 30s — navigating back to a page in that
        // window renders instantly from cache instead of re-hitting Supabase.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route chunks + loaders on link hover/focus so navigation feels
    // instant. Query controls data freshness, so keep router preload stale=0.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
