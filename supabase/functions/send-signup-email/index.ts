import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { email, storeName, confirmationUrl } = await req.json();

    if (!email || !confirmationUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const merchantName = storeName || "التاجر";

    const htmlBody = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:16px;border:1px solid rgba(255,140,0,0.2);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);padding:40px 40px 20px;text-align:center;">
              <div style="width:64px;height:64px;background:rgba(255,140,0,0.15);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <span style="font-size:32px;">📦</span>
              </div>
              <h1 style="color:#FF8C00;font-size:28px;margin:0 0 8px;font-weight:bold;">صِلة</h1>
              <p style="color:#94a3b8;font-size:14px;margin:0;">منصة الشحن والتوصيل المتكاملة</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:30px 40px;">
              <h2 style="color:#f8fafc;font-size:20px;margin:0 0 16px;font-weight:600;">مرحباً بك يا ${merchantName}! 🎉</h2>
              <p style="color:#cbd5e1;font-size:15px;line-height:1.8;margin:0 0 20px;">
                يسعدنا انضمامك إلى عائلة <strong style="color:#FF8C00;">صِلة</strong>. أنت على بُعد خطوة واحدة من بدء استخدام منصتك لإدارة الشحنات والمبيعات بكل سهولة.
              </p>
              <p style="color:#cbd5e1;font-size:15px;line-height:1.8;margin:0 0 30px;">
                لتأكيد بريدك الإلكتروني وتفعيل حسابك، اضغط على الزر أدناه:
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${confirmationUrl}" style="display:inline-block;background:linear-gradient(135deg,#FF8C00,#e67e00);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:16px;font-weight:bold;box-shadow:0 4px 15px rgba(255,140,0,0.3);">
                      تأكيد البريد الإلكتروني ✉️
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#64748b;font-size:13px;line-height:1.6;margin:25px 0 0;text-align:center;">
                إذا لم تقم بإنشاء حساب في صِلة، تجاهل هذه الرسالة.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 30px;border-top:1px solid rgba(255,140,0,0.1);text-align:center;">
              <p style="color:#475569;font-size:12px;margin:0;">
                © ${new Date().getFullYear()} صِلة — Sila. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "صِلة <auth@sila-sy.com>",
        to: [email],
        subject: "تأكيد بريدك الإلكتروني — صِلة",
        html: htmlBody,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
