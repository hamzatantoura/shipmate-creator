import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SY_PHONE_PLACEHOLDER, sanitizeSyrianInput } from "@/shared/lib/syrian-phone";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value: string;
  onChange: (val: string) => void;
}

/** Syria-only phone input. Locks the +963 prefix visually and restricts input to local digits. */
export const SyrianPhoneInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, className, placeholder, ...props }, ref) => {
    return (
      <div className={cn("flex items-stretch", className)} dir="ltr">
        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground select-none">
          🇸🇾 +963
        </span>
        <Input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          dir="ltr"
          className="rounded-l-none"
          value={value}
          placeholder={placeholder ?? SY_PHONE_PLACEHOLDER}
          onChange={(e) => onChange(sanitizeSyrianInput(e.target.value))}
          {...props}
        />
      </div>
    );
  }
);
SyrianPhoneInput.displayName = "SyrianPhoneInput";
