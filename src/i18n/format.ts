import { LANGUAGE_META, type SupportedLanguage } from "./config";

/**
 * Locale-aware formatters. Currency defaults to SYP per platform standard.
 */
export function formatCurrency(
  value: number,
  language: SupportedLanguage,
  currency: string = "SYP"
): string {
  const locale = LANGUAGE_META[language].locale;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString(locale)} ${currency}`;
  }
}

export function formatNumber(value: number, language: SupportedLanguage): string {
  return new Intl.NumberFormat(LANGUAGE_META[language].locale).format(value);
}

export function formatDate(
  value: Date | string | number,
  language: SupportedLanguage,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(LANGUAGE_META[language].locale, options).format(date);
}

export function formatRelativeTime(
  value: Date | string | number,
  language: SupportedLanguage
): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat(LANGUAGE_META[language].locale, { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(diffDay, "day");
}