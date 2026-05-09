import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  LANGUAGE_META,
  LANGUAGE_STORAGE_KEY,
  RTL_LANGUAGES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "./config";

/**
 * Apply the active language to <html> (lang/dir) and persist it to
 * localStorage. Centralizes everything an app shell needs to react
 * to a language switch.
 */
export function useLanguage() {
  const { i18n, t } = useTranslation();

  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : "ar";

  const meta = LANGUAGE_META[current];
  const isRtl = RTL_LANGUAGES.includes(current);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = current;
    html.dir = meta.dir;
    html.dataset.direction = meta.dir;
    html.dataset.lang = current;
  }, [current, meta.dir]);

  const change = useCallback(
    (lng: SupportedLanguage) => {
      i18n.changeLanguage("ar");
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, "ar");
      } catch {
        /* no-op */
      }
    },
    [i18n]
  );

  return {
    language: current,
    meta,
    isRtl,
    change,
    t,
    supported: SUPPORTED_LANGUAGES,
    all: LANGUAGE_META,
  };
}