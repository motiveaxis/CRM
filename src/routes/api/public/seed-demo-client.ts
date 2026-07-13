import { createFileRoute } from "@tanstack/react-router";

/**
 * Temporary developer seeder to create a demo client portal account.
 * Guarded by matching SUPABASE_PROJECT_ID as the x-seed-token header.
 * Safe to remove after use.
 */
export const Route = createFileRoute("/api/public/seed-demo-client")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-seed-token") ?? "";
        const expected = process.env.SUPABASE_PROJECT_ID ?? "";
        if (!expected || token !== expected) {
          return new Response("Forbidden", { status: 403 });
        }

        const body = (await request.json().catch(() => ({}))) as {
          email?: string;
          password?: string;
          company_name?: string;
          contact_name?: string;
          lead_id?: string;
        };

        const email = body.email ?? "demo.client@lovable.dev";
        const password = body.password ?? "DemoClient2026!";
        const company_name = body.company_name ?? "TestCo Inc";
        const contact_name = body.contact_name ?? "Demo Client";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Create (or reuse) the auth user with confirmed email.
        let authUserId: string | null = null;
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { company_name, contact_name, portal: true },
        });
        if (createErr) {
          const msg = createErr.message?.toLowerCase() ?? "";
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            let page = 1;
            while (page < 20 && !authUserId) {
              const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
                page,
                perPage: 200,
              });
              if (listErr) return new Response(listErr.message, { status: 500 });
              const match = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
              if (match) authUserId = match.id;
              if (list.users.length < 200) break;
              page += 1;
            }
            // Reset the password so the caller can log in with the returned creds.
            if (authUserId) {
              await supabaseAdmin.auth.admin.updateUserById(authUserId, {
                password,
                email_confirm: true,
              });
            }
          } else {
            return new Response(createErr.message, { status: 500 });
          }
        } else {
          authUserId = created?.user?.id ?? null;
        }

        if (!authUserId) {
          return new Response("Failed to create auth user", { status: 500 });
        }

        // 2) Ensure a lead exists to satisfy clients.lead_id NOT NULL.
        let leadId: string | null = body.lead_id ?? null;
        if (!leadId) {
          const { data: leadRow } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          if (leadRow) {
            leadId = leadRow.id;
          } else {
            const { data: newLead, error: leadErr } = await (supabaseAdmin
              .from("leads") as any)
              .insert({
                company_name,
                first_name: contact_name.split(" ")[0] ?? contact_name,
                last_name: contact_name.split(" ").slice(1).join(" ") || "Client",
                email,
                source: "seed",
                status: "closed_won",
                priority: "medium",
              })
              .select("id")
              .single();
            if (leadErr) return new Response(leadErr.message, { status: 500 });
            leadId = newLead.id;
          }
        }

        // 3) Ensure a deal exists to satisfy clients.deal_id NOT NULL.
        let dealId: string | null = null;
        const { data: dealRow } = await supabaseAdmin
          .from("deals")
          .select("id")
          .eq("lead_id", leadId!)
          .maybeSingle();
        if (dealRow) {
          dealId = dealRow.id;
        } else {
          const { data: newDeal, error: dealErr } = await (supabaseAdmin
            .from("deals") as any)
            .insert({
              lead_id: leadId!,
              company_name,
              stage: "closed_won",
              value: 0,
            })
            .select("id")
            .single();
          if (dealErr) return new Response(dealErr.message, { status: 500 });
          dealId = newDeal.id;
        }

        // 4) Upsert the client row and link to portal user.
        const { data: existingClient } = await supabaseAdmin
          .from("clients")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        let clientId: string;
        if (existingClient) {
          const { error: updErr } = await supabaseAdmin
            .from("clients")
            .update({
              portal_user_id: authUserId,
              portal_created: true,
              portal_created_at: new Date().toISOString(),
              onboarding_step: "portal_active",
              status: "active",
            })
            .eq("id", existingClient.id);
          if (updErr) return new Response(updErr.message, { status: 500 });
          clientId = existingClient.id;
        } else {
          const { data: newClient, error: clientErr } = await supabaseAdmin
            .from("clients")
            .insert({
              lead_id: leadId!,
              deal_id: dealId!,
              company_name,
              contact_name,
              email,
              status: "active",
              onboarding_step: "portal_active",
              portal_user_id: authUserId,
              portal_created: true,
              portal_created_at: new Date().toISOString(),
              pricing_tier: "starter",
              monthly_value: 2500,
            })
            .select("id")
            .single();
          if (clientErr) return new Response(clientErr.message, { status: 500 });
          clientId = newClient.id;
        }

        return new Response(
          JSON.stringify({
            ok: true,
            email,
            password,
            auth_user_id: authUserId,
            client_id: clientId,
            lead_id: leadId,
            deal_id: dealId,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
