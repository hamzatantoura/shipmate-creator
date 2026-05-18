import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  vendor_id: string;
  password: string;
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

    // Admin gate
    const adminCheckClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await adminCheckClient.auth.getUser();
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
    const password = (body.password || "").trim();
    if (!vendor_id || !password) {
      return new Response(JSON.stringify({ error: "vendor_id و password مطلوبان" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: info, error: gErr } = await admin.auth.admin.getUserById(vendor_id);
    if (gErr || !info.user?.email) {
      return new Response(JSON.stringify({ error: "المستخدم غير موجود" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = info.user.email;

    // Use a fresh anon client (no session persistence) to test the credentials.
    const tester = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: signIn, error: signErr } = await tester.auth.signInWithPassword({ email, password });
    if (signErr || !signIn.user) {
      return new Response(
        JSON.stringify({ ok: false, valid: false, error: signErr?.message ?? "بيانات الدخول غير صحيحة" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    try { await tester.auth.signOut(); } catch { /* ignore */ }

    const username = email.replace(/@courier\.sila\.local$/i, "");
    return new Response(
      JSON.stringify({ ok: true, valid: true, username, login_email: email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});