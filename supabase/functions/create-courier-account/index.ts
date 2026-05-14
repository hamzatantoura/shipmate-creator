import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  username: string;
  password: string;
  courier_id: string;
  contact_person?: string;
}

function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

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

    // Verify caller is admin (using anon client + caller's JWT)
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
    const username = sanitizeUsername(body.username || "");
    const password = (body.password || "").trim();
    const courier_id = (body.courier_id || "").trim();

    if (!username || username.length < 3) {
      return new Response(JSON.stringify({ error: "اسم المستخدم غير صالح (3 أحرف على الأقل، أحرف إنجليزية وأرقام و _ فقط)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "كلمة المرور 6 أحرف على الأقل" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!courier_id) {
      return new Response(JSON.stringify({ error: "courier_id مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const loginEmail = `${username}@courier.sila.local`;

    // Create the user — confirmed immediately, bypassing email verification.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: "vendor",
        contact_person: body.contact_person ?? "",
        username,
      },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "فشل إنشاء الحساب";
      const friendly = /already|registered|exists/i.test(msg)
        ? "اسم المستخدم مستخدم مسبقاً، اختر اسماً آخر"
        : msg;
      return new Response(JSON.stringify({ error: friendly }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = created.user.id;

    // Enforce single role = vendor (handle_new_user trigger already inserted based on metadata).
    await admin.from("profiles").update({ role: "vendor" }).eq("user_id", newUserId);
    await admin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleInsertErr } = await admin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "vendor" });
    if (roleInsertErr) {
      return new Response(JSON.stringify({ error: `تم إنشاء الحساب لكن فشل تعيين الدور: ${roleInsertErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Link the courier record.
    const { error: linkErr } = await admin
      .from("couriers")
      .update({ vendor_id: newUserId, contact_email: loginEmail })
      .eq("id", courier_id);
    if (linkErr) {
      return new Response(JSON.stringify({ error: `تم إنشاء الحساب لكن فشل الربط: ${linkErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ user_id: newUserId, login_email: loginEmail, username }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});