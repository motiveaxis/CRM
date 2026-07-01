import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  clientId: z.string().uuid(),
  redirectTo: z.string().url().optional(),
});

/**
 * Invite a client contact to the portal via Supabase magic-link email.
 * Links the created auth user to clients.portal_user_id and flips portal flags.
 * Admin-only.
 */
export const invitePortalUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, email, contact_name, company_name, portal_user_id")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientErr) throw clientErr;
    if (!client) throw new Error("Client not found");
    if (client.portal_user_id) throw new Error("Portal user already linked");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try invite first; if user already exists in auth, look them up instead.
    let authUserId: string | null = null;
    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(client.email, {
        data: { company_name: client.company_name, contact_name: client.contact_name },
        redirectTo: data.redirectTo,
      });

    if (inviteErr) {
      const msg = inviteErr.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // Find existing user by email via listUsers pagination
        let page = 1;
        while (page < 20 && !authUserId) {
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 200,
          });
          if (listErr) throw listErr;
          const match = list.users.find((u) => u.email?.toLowerCase() === client.email.toLowerCase());
          if (match) authUserId = match.id;
          if (list.users.length < 200) break;
          page += 1;
        }
        if (!authUserId) throw inviteErr;
      } else {
        throw inviteErr;
      }
    } else {
      authUserId = invited?.user?.id ?? null;
    }

    if (!authUserId) throw new Error("Failed to obtain auth user id");

    const { error: updErr } = await supabaseAdmin
      .from("clients")
      .update({
        portal_user_id: authUserId,
        portal_created: true,
        portal_created_at: new Date().toISOString(),
        onboarding_step: "portal_invited",
      })
      .eq("id", client.id);
    if (updErr) throw updErr;

    return { ok: true, authUserId, invited: !inviteErr };
  });

const credSchema = z.object({
  clientId: z.string().uuid(),
  payload: z.string().min(1).max(50000),
  keyRef: z.string().max(200).optional(),
});

/**
 * Admin-side credential intake on behalf of a client.
 * Stores the payload (already encrypted client-side or treated as opaque)
 * into credentials_vault and flips credentials_submitted on the client.
 */
export const submitClientCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => credSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isStaff } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!isStaff) throw new Error("Forbidden: staff only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: vaultErr } = await supabaseAdmin
      .from("credentials_vault")
      .upsert(
        {
          client_id: data.clientId,
          encrypted_payload: data.payload,
          encryption_key_ref: data.keyRef ?? "admin-intake",
          submitted_by: userId,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "client_id" },
      );
    if (vaultErr) throw vaultErr;

    const { error: updErr } = await supabaseAdmin
      .from("clients")
      .update({
        credentials_submitted: true,
        onboarding_step: "credentials_received",
      })
      .eq("id", data.clientId);
    if (updErr) throw updErr;

    // Fire provisioning webhook if configured
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("webhook_provision_instance")
      .maybeSingle();

    if (settings?.webhook_provision_instance) {
      try {
        await fetch(settings.webhook_provision_instance, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ client_id: data.clientId, event: "credentials_submitted" }),
        });
      } catch (e) {
        console.error("provision webhook failed", e);
      }
    }

    return { ok: true };
  });
