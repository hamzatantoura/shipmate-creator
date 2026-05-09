import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import arCommon from "@/locales/ar/common.json";
import arDashboard from "@/locales/ar/dashboard.json";
import arAuth from "@/locales/ar/auth.json";
import arValidation from "@/locales/ar/validation.json";
import arLanding from "@/locales/ar/landing.json";

import enCommon from "@/locales/en/common.json";
import enDashboard from "@/locales/en/dashboard.json";
import enAuth from "@/locales/en/auth.json";
import enValidation from "@/locales/en/validation.json";
import enLanding from "@/locales/en/landing.json";

import trCommon from "@/locales/tr/common.json";
import trDashboard from "@/locales/tr/dashboard.json";
import trAuth from "@/locales/tr/auth.json";
import trValidation from "@/locales/tr/validation.json";
import trLanding from "@/locales/tr/landing.json";

export const SUPPORTED_LANGUAGES = ["ar"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const RTL_LANGUAGES: SupportedLanguage[] = ["ar"];

export const LANGUAGE_STORAGE_KEY = "sila.lang";

export const LANGUAGE_META: Record<
  SupportedLanguage,
  { label: string; nativeLabel: string; flag: string; dir: "rtl" | "ltr"; locale: string }
> = {
  ar: { label: "Arabic", nativeLabel: "العربية", flag: "🇸🇾", dir: "rtl", locale: "ar-SY" },
};

export const resources = {
  ar: {
    common: arCommon,
    dashboard: arDashboard,
    auth: arAuth,
    validation: arValidation,
    landing: arLanding,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    auth: enAuth,
    validation: enValidation,
    landing: enLanding,
  },
  tr: {
    common: trCommon,
    dashboard: trDashboard,
    auth: trAuth,
    validation: trValidation,
    landing: trLanding,
  },
} as const;

/**
 * Initialize i18next with localStorage detection, Arabic default,
 * and modular namespaces. Call once at app bootstrap.
 */
if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: "ar",
      fallbackLng: "ar",
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      ns: ["common", "dashboard", "auth", "validation", "landing"],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      detection: {
        order: [],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: [],
      },
      returnNull: false,
    });
}

export default i18n;