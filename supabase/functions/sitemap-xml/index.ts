// Public sitemap.xml generator.
// Lists active stores and active products. No auth required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE = Deno.env.get("PUBLIC_SITE_URL") || "https://sila-sy.com";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

function renderSitemap(urls: UrlEntry[]): string {
  const items = urls
    .map((u) => {
      const tags = [
        `<loc>${xmlEscape(u.loc)}</loc>`,
        u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "",
        u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : "",
        u.priority ? `<priority>${u.priority}</priority>` : "",
      ]
        .filter(Boolean)
        .join("");
      return `<url>${tags}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);
    const urls: UrlEntry[] = [
      { loc: `${SITE}/`, changefreq: "weekly", priority: "1.0", lastmod: today },
      { loc: `${SITE}/track`, changefreq: "weekly", priority: "0.6" },
      { loc: `${SITE}/track-shipment`, changefreq: "weekly", priority: "0.6" },
      { loc: `${SITE}/login`, changefreq: "monthly", priority: "0.3" },
      { loc: `${SITE}/signup`, changefreq: "monthly", priority: "0.3" },
    ];

    // Active verified merchants → /store/<user_id>
    const { data: merchants } = await supabase
      .from("merchants")
      .select("user_id, updated_at, is_active, verification_status")
      .eq("is_active", true)
      .eq("verification_status", "verified")
      .limit(5000);

    merchants?.forEach((m: any) => {
      urls.push({
        loc: `${SITE}/store/${m.user_id}`,
        lastmod: m.updated_at?.slice(0, 10),
        changefreq: "daily",
        priority: "0.8",
      });
    });

    // Active products → /product/<slug or id>
    const { data: products } = await supabase
      .from("products")
      .select("id, slug, updated_at, is_active, deleted_at")
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(20000);

    products?.forEach((p: any) => {
      urls.push({
        loc: `${SITE}/product/${p.slug || p.id}`,
        lastmod: p.updated_at?.slice(0, 10),
        changefreq: "daily",
        priority: "0.7",
      });
    });

    const xml = renderSitemap(urls);
    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("sitemap-xml error", e);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>`,
      { status: 500, headers: { ...corsHeaders, "content-type": "application/xml" } },
    );
  }
});