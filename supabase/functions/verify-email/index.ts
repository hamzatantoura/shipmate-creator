import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const redirectTo = url.searchParams.get("redirect_to") || "/login";

  if (!token) {
    return new Response("رمز التحقق مفقود", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Find the token
  const { data: tokenRow, error } = await supabase
    .from("email_verification_tokens")
    .select("*")
    .eq("token", token)
    .eq("used", false)
    .single();

  if (error || !tokenRow) {
    return new Response(renderPage("رمز غير صالح أو منتهي الصلاحية", false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Check expiry
  if (new Date(tokenRow.expires_at) < new Date()) {
    return new Response(renderPage("انتهت صلاحية رابط التأكيد", false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Mark token as used
  await supabase
    .from("email_verification_tokens")
    .update({ used: true })
    .eq("id", tokenRow.id);

  // Update merchant email_confirmed
  await supabase
    .from("merchants")
    .update({ email_confirmed: true })
    .eq("user_id", tokenRow.user_id);

  // Redirect to login with success
  const siteUrl = url.origin.replace("qhdhjzyduwzqutmialgp.supabase.co", "");
  
  return new Response(renderPage("تم تأكيد بريدك الإلكتروني بنجاح! 🎉", true), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

function renderPage(message: string, success: boolean): string {
  const color = success ? "#22c55e" : "#ef4444";
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>صِلة — تأكيد البريد</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="background:#1e293b;border-radius:16px;border:1px solid rgba(255,140,0,0.2);padding:50px 40px;text-align:center;max-width:500px;margin:20px;">
  <h1 style="color:#FF8C00;font-size:28px;margin:0 0 20px;">صِلة</h1>
  <p style="color:${color};font-size:18px;font-weight:600;margin:0 0 16px;">${message}</p>
  ${success ? `<p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">يمكنك الآن تسجيل الدخول والبدء باستخدام المنصة</p>
  <a href="/login" style="display:inline-block;background:linear-gradient(135deg,#FF8C00,#e67e00);color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:15px;font-weight:bold;">تسجيل الدخول</a>` : 
  `<a href="/signup" style="display:inline-block;background:#334155;color:#94a3b8;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;">إعادة التسجيل</a>`}
</div>
</body></html>`;
}
