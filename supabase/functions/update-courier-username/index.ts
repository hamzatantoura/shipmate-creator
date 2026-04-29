import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  vendor_id: string;
  username: string;
}

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const EMAIL_DOMAIN = "@courier.sila.local";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admins only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    const vendor_id = (body.vendor_id || "").trim();
    const username = (body.username || "").trim().toLowerCase();

    if (!vendor_id) {
      return new Response(JSON.stringify({ error: "vendor_id مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup-only mode: return current username when no new username provided
    if (!username) {
      const { data: info, error: gErr } = await admin.auth.admin.getUserById(vendor_id);
      if (gErr || !info.user) {
        return new Response(JSON.stringify({ error: "المستخدم غير موجود" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const em = info.user.email ?? "";
      const cur = em.replace(/@courier\.sila\.local$/i, "");
      return new Response(
        JSON.stringify({ ok: true, username: cur, login_email: em, lookup: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!USERNAME_RE.test(username)) {
      return new Response(JSON.stringify({ error: "اسم المستخدم: 3-32 حرفًا، أحرف إنجليزية صغيرة وأرقام و _ فقط" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newEmail = `${username}${EMAIL_DOMAIN}`;

    // Ensure target email isn't already taken by a different user
    const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const taken = existing?.users?.find(u => (u.email || "").toLowerCase() === newEmail && u.id !== vendor_id);
    if (taken) {
      return new Response(JSON.stringify({ error: "اسم المستخدم مستخدم مسبقاً" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userInfo, error: getErr } = await admin.auth.admin.getUserById(vendor_id);
    if (getErr || !userInfo.user) {
      return new Response(JSON.stringify({ error: "المستخدم غير موجود" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(vendor_id, {
      email: newEmail,
      email_confirm: true,
    });
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, username, login_email: newEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});