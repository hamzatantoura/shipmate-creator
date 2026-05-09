import "i18next";
import type common from "@/locales/ar/common.json";
import type dashboard from "@/locales/ar/dashboard.json";
import type auth from "@/locales/ar/auth.json";
import type validation from "@/locales/ar/validation.json";
import type landing from "@/locales/ar/landing.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      dashboard: typeof dashboard;
      auth: typeof auth;
      validation: typeof validation;
      landing: typeof landing;
    };
  }
}
