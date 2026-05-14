import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<"input"> & { error?: string };

/**
 * Password input with show/hide toggle. Forwards ref so it works with
 * react-hook-form's `register()`.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  ({ className, error, ...props }, ref) => {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          dir="ltr"
          className={cn("pe-10", error && "border-destructive focus-visible:ring-destructive", className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
          aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";