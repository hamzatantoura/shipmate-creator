import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/i18n/use-language";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";

interface LanguageSwitcherProps {
  variant?: "default" | "ghost" | "outline";
  align?: "start" | "center" | "end";
  compact?: boolean;
}

/**
 * Dropdown language switcher. Persists to localStorage and updates
 * <html lang/dir> via useLanguage().
 */
export function LanguageSwitcher({
  variant = "ghost",
  align = "end",
  compact = false,
}: LanguageSwitcherProps) {
  const { language, change, t, all } = useLanguage();
  const current = all[language];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={compact ? "icon" : "sm"} aria-label={t("language.label")}>
          <Globe className="h-4 w-4" />
          {!compact && (
            <span className="ms-2 hidden sm:inline">
              {current.flag} {current.nativeLabel}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[10rem]">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((lng) => {
          const m = all[lng];
          const active = lng === language;
          return (
            <DropdownMenuItem
              key={lng}
              onClick={() => change(lng)}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{m.flag}</span>
                <span>{m.nativeLabel}</span>
              </span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;