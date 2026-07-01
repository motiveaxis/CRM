import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { ClientShell } from "@/components/client-shell";
import { ClientGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { toast } from "sonner";

export const Route = createFileRoute("/client/support")({
  head: () => ({ meta: [{ title: "Support — MotiveAxis" }] }),
  component: () => (
    <ClientGuard>
      <ClientShell breadcrumb="PORTAL / SUPPORT">
        <Page />
      </ClientShell>
    </ClientGuard>
  ),
});

function fmt(s: string | null) {
  return s ? new Date(s).toLocaleString() : "—";
}

function Page() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");

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

  const { data: tickets = [] } = useQuery({
    queryKey: ["client-tickets", client?.id],
    enabled: !!client,
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useRealtimeInvalidate("client-tickets-rt", [
    {
      table: "support_tickets",
      filter: client ? `client_id=eq.${client.id}` : undefined,
      queryKeys: [["client-tickets", client?.id]],
    },
    {
      table: "support_ticket_attachments",
      queryKeys: [["ticket-attachments"]],
    },
  ]);



  const create = useMutation({
    mutationFn: async () => {
      if (!subject.trim()) throw new Error("Subject required");
      const { error } = await supabase.from("support_tickets").insert({
        client_id: client!.id,
        ticket_id: "",
        subject: subject.trim(),
        description: description.trim() || null,
        priority,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubject("");
      setDescription("");
      setPriority("normal");
      qc.invalidateQueries({ queryKey: ["client-tickets"] });
      toast.success("Ticket submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!client) return <div className="ma-panel p-6 ma-label">No client record linked.</div>;

  const open = tickets.filter((t) => t.status !== "resolved" && t.status !== "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1>Support</h1>
          <div className="ma-label mt-2">{open} open · {tickets.length} total</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="ma-panel p-5 lg:col-span-1 space-y-3">
          <div className="ma-label">New ticket</div>
          <input
            className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[4px] px-3 py-2 text-sm"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[4px] px-3 py-2 text-sm min-h-[100px]"
            placeholder="Describe the issue…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select
            className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[4px] px-3 py-2 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <button
            disabled={create.isPending}
            onClick={() => create.mutate()}
            className="w-full bg-[color:var(--accent-red)] text-white text-xs font-semibold py-2 rounded-[4px] disabled:opacity-50"
          >
            {create.isPending ? "Submitting…" : "Submit ticket"}
          </button>
        </div>

        <div className="ma-panel lg:col-span-2">
          <div className="px-5 py-3 border-b border-[color:var(--border)] ma-label">Ticket history</div>
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-[color:var(--text-secondary)]">No tickets yet.</div>
          ) : (
            <div className="divide-y divide-[color:var(--border)]">
              {tickets.map((t) => (
                <div key={t.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{t.subject}</div>
                      <div className="text-[11px] font-mono text-[color:var(--text-muted)] mt-0.5">{t.ticket_id}</div>
                      {t.description && <p className="text-xs text-[color:var(--text-secondary)] mt-2">{t.description}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-[3px] uppercase ${
                        t.status === "open" ? "bg-amber-500/15 text-amber-300" :
                        t.status === "in_progress" ? "bg-blue-500/15 text-blue-300" :
                        t.status === "resolved" || t.status === "closed" ? "bg-emerald-500/15 text-emerald-300" :
                        "bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]"
                      }`}>{t.status}</span>
                      <span className="text-[10px] text-[color:var(--text-muted)] uppercase">{t.priority}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-[color:var(--text-muted)] mt-2">Opened {fmt(t.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
