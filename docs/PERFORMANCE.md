# CRM Performance Playbook

Single source of truth for how the MotiveAxis CRM stays fast. Reference this
file when adding new routes, hooks, or Supabase queries — do not re-invent
patterns per screen.

---

## 1. Why the page sometimes "doesn't load"

The most common report is a blank screen with `[vite] server connection
lost. Polling for restart...` in the console. That message is **not** an
app bug — it's the Vite HMR websocket noticing that the dev server was
restarted (new dependency, config change, sandbox recycle). The HTML still
serves 200. **Fix: reload the tab.** The websocket reconnects and the app
renders normally.

Real "won't load" failures usually fall into one of these buckets:

| Symptom | Root cause | Fix |
| --- | --- | --- |
| Blank + "connection lost" | HMR ws dropped after Vite restart | Hard reload |
| Blank + 500 in network tab | SSR error in a route `loader`/`head()` | Check dev-server logs, wrap risky work in server fn |
| Spinner forever | `useQuery` never resolves — RLS blocked row, missing GRANT | Check Supabase logs, verify policy + grant |
| Slow first paint on `/admin/*` | Waterfall of client-only `useQuery` calls | See §3 |

---

## 2. Router + Query defaults (already applied)

`src/router.tsx` is the one place caching + preload behaviour is configured.

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s of "fresh" — no refetch on remount
      gcTime: 5 * 60_000,         // keep unused cache 5m
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRouter({
  defaultPreload: "intent",       // preload route chunk + loader on hover/focus
  defaultPreloadStaleTime: 0,     // Query owns freshness, not the router
});
```

Effect: hovering a sidebar link warms the JS chunk **and** the Supabase
query before the click, so navigation is near-instant on a warm cache.

Override per query when the data must be live (e.g. inbox counts):
```ts
useQuery({ queryKey: [...], queryFn: ..., staleTime: 0 });
```

---

## 3. Rules for new admin/client screens

1. **One Supabase round-trip per screen where possible.** Prefer a single
   `select("*, related(*)")` join over N separate `useQuery`s.
2. **Every list query needs `.limit(...)` and an `order(...)`.** Supabase
   caps at 1000 rows — anything approaching that must paginate.
3. **Never `select("*")` on wide tables (`leads`, `reports`, `clients`)
   inside a list view.** Select only the columns the table renders. Detail
   pages can fetch the full row.
4. **Realtime is opt-in, not default.** A `supabase.channel(...)` per open
   tab is expensive. Only subscribe on screens where seconds-fresh data
   materially matters (Pipeline, Support tickets). Always tear down in the
   `useEffect` cleanup.
5. **Filters, search, sort, page live in the URL** via
   `validateSearch` + `Route.useSearch()`. This makes them shareable and
   keeps `useState` churn out of the render path.
6. **Debounce search inputs** (250–400ms) before they hit the query key.
7. **`useMemo` derived lists** (`filteredLeads`, `leadsByStage`) so DnD /
   filter interactions don't re-scan the array on every keystroke.

---

## 4. Bundle + asset rules

- **Do not `export` route component functions.** Exporting them defeats
  TanStack's automatic code-splitting and bloats the initial bundle.
- **Heavy client-only libs** (charts, DnD, PDF) go behind `React.lazy` +
  `<Suspense>` or a `.lazy.tsx` route file.
- **Images**: use `?format=webp` / `?format=avif` via `vite-imagetools` for
  bundled assets. Never ship raw multi-MB PNGs.
- **Fonts**: loaded once from `__root.tsx` `<link>` — don't re-import in
  route files.

---

## 5. Supabase / DB checklist

- Every `public.*` table used by the app has explicit `GRANT`s (see
  `public-schema-grants` guideline). A missing grant surfaces as an
  infinite spinner, not an error toast.
- Add an index for every column you filter or order by in a hot query
  (`leads.status`, `leads.updated_at`, `reports.client_id`, ...).
- Use `supabase--slow_queries` when a screen feels sluggish before
  refactoring frontend code — the offender is usually the query plan.

---

## 6. Debug workflow when a screen is slow

1. Network tab → sort by time. Which request is the tall bar?
2. If it's Supabase: copy the URL, run `EXPLAIN ANALYZE` via
   `supabase--read_query`. Add an index if a Seq Scan shows up on a large
   table.
3. If it's a JS chunk: check whether the route file `export`s its
   component (breaks splitting) or pulls a heavy lib at module scope.
4. If it's "many small requests": collapse into one join, or move the
   fetch into the route `loader` with `ensureQueryData` so it runs in
   parallel with the chunk download.

---

## 7. Anti-patterns — do not reintroduce

- `useEffect` + `fetch` / `supabase.from(...)` for initial render data.
  Use `useQuery` (or a route loader + `useSuspenseQuery`).
- `useQuery` with `refetchInterval` when Realtime already invalidates
  the same key — double work.
- Multiple `supabase.channel(...)` subscriptions to the **same** table
  from different components on the same page. Consolidate into one
  hook (see `src/hooks/use-realtime-invalidate.ts`).
- Storing filter/search/page state in `useState` on a screen that users
  bookmark or share — put it in the URL instead.
