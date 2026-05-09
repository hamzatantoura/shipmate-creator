import { useEffect } from "react";

interface SeoProps {
  title: string;
  description?: string;
  canonical?: string;
  image?: string | null;
  type?: "website" | "article" | "product";
  /** Optional JSON-LD structured data object(s) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Set to true to allow indexing (default), false adds noindex,nofollow */
  index?: boolean;
  locale?: string;
}

const SEO_TAG = "data-seo";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute(SEO_TAG, "");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute(SEO_TAG, "");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function clearJsonLd() {
  document.head
    .querySelectorAll(`script[type="application/ld+json"][${SEO_TAG}]`)
    .forEach((n) => n.remove());
}

function appendJsonLd(data: Record<string, unknown>) {
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.setAttribute(SEO_TAG, "");
  s.text = JSON.stringify(data);
  document.head.appendChild(s);
}

/**
 * Lightweight head manager. Updates title, meta description, canonical,
 * OpenGraph, Twitter cards and JSON-LD without adding a head dependency.
 * Designed to be safe for SPA navigation.
 */
export function Seo({
  title,
  description,
  canonical,
  image,
  type = "website",
  jsonLd,
  index = true,
  locale = "ar_SY",
}: SeoProps) {
  useEffect(() => {
    const fullTitle = title.length > 60 ? title.slice(0, 57) + "…" : title;
    document.title = fullTitle;

    const desc = (description || "").slice(0, 160);
    if (desc) upsertMeta("name", "description", desc);

    upsertMeta("name", "robots", index ? "index,follow" : "noindex,nofollow");

    const url = canonical || (typeof window !== "undefined" ? window.location.href : "");
    if (url) upsertLink("canonical", url);

    // OpenGraph
    upsertMeta("property", "og:title", fullTitle);
    if (desc) upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:type", type === "product" ? "product" : type);
    if (url) upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:locale", locale);
    if (image) upsertMeta("property", "og:image", image);

    // Twitter
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    if (desc) upsertMeta("name", "twitter:description", desc);
    if (image) upsertMeta("name", "twitter:image", image);

    // JSON-LD
    clearJsonLd();
    if (jsonLd) {
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      arr.forEach(appendJsonLd);
    }

    return () => {
      // Keep tags between routes; only JSON-LD must be reset on next mount.
    };
  }, [title, description, canonical, image, type, jsonLd, index, locale]);

  return null;
}