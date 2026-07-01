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
                <TicketRow key={t.id} ticket={t} clientId={client!.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TicketRowProps {
  ticket: {
    id: string;
    ticket_id: string;
    subject: string;
    description: string | null;
    status: string;
    priority: string;
    created_at: string;
  };
  clientId: string;
}

function TicketRow({ ticket, clientId }: TicketRowProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ["ticket-attachments", ticket.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_ticket_attachments")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handleUpload = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File exceeds 25 MB");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${clientId}/${ticket.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("support_ticket_attachments").insert({
        ticket_id: ticket.id,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
      });
      if (insErr) throw insErr;
      qc.invalidateQueries({ queryKey: ["ticket-attachments", ticket.id] });
      toast.success("File attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("ticket-attachments")
      .createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-sm">{ticket.subject}</div>
          <div className="text-[11px] font-mono text-[color:var(--text-muted)] mt-0.5">{ticket.ticket_id}</div>
          {ticket.description && <p className="text-xs text-[color:var(--text-secondary)] mt-2">{ticket.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-[3px] uppercase ${
            ticket.status === "open" ? "bg-amber-500/15 text-amber-300" :
            ticket.status === "in_progress" ? "bg-blue-500/15 text-blue-300" :
            ticket.status === "resolved" || ticket.status === "closed" ? "bg-emerald-500/15 text-emerald-300" :
            "bg-[color:var(--surface-2)] text-[color:var(--text-secondary)]"
          }`}>{ticket.status}</span>
          <span className="text-[10px] text-[color:var(--text-muted)] uppercase">{ticket.priority}</span>
        </div>
      </div>
      <div className="text-[11px] text-[color:var(--text-muted)] mt-2">Opened {fmt(ticket.created_at)}</div>

      {attachments.length > 0 && (
        <ul className="mt-3 space-y-1">
          {attachments.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => openAttachment(a.storage_path)}
                className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--text-secondary)] hover:text-white"
              >
                <Paperclip size={11} />
                <span>{a.file_name}</span>
                {a.file_size && <span className="text-[color:var(--text-muted)]">· {(a.file_size / 1024).toFixed(0)} KB</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--text-secondary)] hover:text-white disabled:opacity-40"
        >
          {uploading ? <X size={11} /> : <Upload size={11} />}
          {uploading ? "Uploading…" : "Attach file"}
        </button>
      </div>
    </div>
  );
}

