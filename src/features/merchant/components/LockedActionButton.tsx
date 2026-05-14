import { ReactNode } from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { useMerchantApproval } from "@/features/merchant/hooks/use-merchant-approval";

interface Props extends ButtonProps {
  children: ReactNode;
  /** When true, the button is gated by approval. Default: true. */
  gated?: boolean;
  /** Override message shown in the tooltip when locked. */
  lockedMessage?: string;
  /** Show a small lock icon next to the children when locked. */
  showLockIcon?: boolean;
}

/**
 * Action button that is automatically disabled with a tooltip when the
 * current merchant is not yet verified ("approved"). Use it for any action
 * that should be reserved for active merchants — e.g. creating shipments,
 * printing waybills, bulk import.
 */
export default function LockedActionButton({
  children,
  gated = true,
  lockedMessage,
  showLockIcon = true,
  disabled,
  onClick,
  ...rest
}: Props) {
  const { isApproved, lockMessage, loading } = useMerchantApproval();
  const locked = gated && !loading && !isApproved;
  const finalDisabled = disabled || locked;
  const message = lockedMessage || lockMessage;

  const btn = (
    <Button
      {...rest}
      disabled={finalDisabled}
      aria-disabled={finalDisabled}
      onClick={(e) => {
        if (locked) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.(e);
      }}
    >
      {locked && showLockIcon && <Lock className="h-3.5 w-3.5 opacity-70" />}
      {children}
    </Button>
  );

  if (!locked) return btn;

  return (
    <TooltipProvider>
      <Tooltip>
        {/* span wrapper lets the tooltip work on a disabled button */}
        <TooltipTrigger asChild>
          <span className="inline-flex">{btn}</span>
        </TooltipTrigger>
        <TooltipContent>{message}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}