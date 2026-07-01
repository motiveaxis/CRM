import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { FileText, ExternalLink, Shield } from "lucide-react";

export const Route = createFileRoute("/client/documents")({
  head: () => ({ meta: [{ title: "Documents — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="PORTAL / DOCUMENTS">
        <Page />
      </ClientShell>
    </ClientGuard>
  ),
});

function fmt(s: string | null) {
  return s ? new Date(s).toLocaleDateString() : "—";
}

function Page() {
  const { user } = useSession();

  const { data: client } = useQuery({
    queryKey: ["client-self", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("portal_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: deal } = useQuery({
    queryKey: ["client-deal", client?.deal_id],
    enabled: !!client?.deal_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("*")
        .eq("id", client!.deal_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: report } = useQuery({
    queryKey: ["client-report", client?.report_id],
    enabled: !!client?.report_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .eq("id", client!.report_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: credSubmitted } = useQuery({
    queryKey: ["client-creds", client?.id],
    enabled: !!client,
    queryFn: async () => {
      const { data } = await supabase
        .from("credentials_vault")
        .select("submitted_at")
        .eq("client_id", client!.id)
        .maybeSingle();
      return data;
    },
  });

  useRealtimeInvalidate("client-docs-rt", [
    {
      table: "reports",
      queryKeys: [["client-report", client?.report_id ?? undefined]],
    },
    {
      table: "deals",
      queryKeys: [["client-deal", client?.deal_id]],
    },
    {
      table: "credentials_vault",
      filter: client ? `client_id=eq.${client.id}` : undefined,
      queryKeys: [["client-creds", client?.id]],
    },
  ]);


  if (!client) return <div className="ma-panel p-6 ma-label">No client record linked.</div>;

  type Doc = { title: string; sub: string; url: string | null; meta: string; icon: typeof FileText };
  const docs: Doc[] = [];
  if (report?.pdf_url) {
    docs.push({
      title: "Automation Report",
      sub: `${report.vertical} · ${report.report_id}`,
      url: report.pdf_url,
      meta: `Generated ${fmt(report.pdf_generated_at)}`,
      icon: FileText,
    });
  }
  if (deal?.contract_url) {
    docs.push({
      title: "Service Agreement",
      sub: `${deal.deal_id} · ${deal.pricing_tier ?? "—"}`,
      url: deal.contract_url,
      meta: `Signed ${fmt(deal.contract_signed_at)}`,
      icon: FileText,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Documents</h1>
        <div className="ma-label mt-2">Contracts, reports, and credentials</div>
      </div>

      <div className="ma-panel">
        <div className="px-5 py-3 border-b border-[color:var(--border)] ma-label">Files</div>
        {docs.length === 0 ? (
          <div className="p-8 text-center text-sm text-[color:var(--text-secondary)]">
            No documents are available yet. Your report and contract will appear here once issued.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {docs.map((d) => {
              const Icon = d.icon;
              return (
                <a
                  key={d.title}
                  href={d.url!}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[color:var(--surface-2)] transition-colors"
                >
                  <div className="w-9 h-9 rounded-[4px] bg-[color:var(--surface-2)] flex items-center justify-center shrink-0">
                    <Icon size={16} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{d.title}</div>
                    <div className="text-[11px] text-[color:var(--text-secondary)] mt-0.5">{d.sub}</div>
                    <div className="text-[11px] text-[color:var(--text-muted)] mt-0.5">{d.meta}</div>
                  </div>
                  <ExternalLink size={14} strokeWidth={1.5} className="text-[color:var(--text-secondary)]" />
                </a>
              );
            })}
          </div>
        )}
      </div>

      <div className="ma-panel p-5">
        <div className="flex items-start gap-3">
          <Shield size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="ma-label">Credentials vault</div>
            <div className="text-sm mt-1">
              {credSubmitted
                ? `Submitted ${fmt(credSubmitted.submitted_at)} — encrypted and stored securely.`
                : "Awaiting your credentials submission to begin the automation build."}
            </div>
            <div className="text-[11px] text-[color:var(--text-secondary)] mt-2">
              Credentials are end-to-end encrypted. MotiveAxis staff cannot read raw values.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
