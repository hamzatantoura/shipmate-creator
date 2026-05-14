import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { friendlyAuthError } from "@/features/auth/lib/auth-schemas";

/** Google OAuth sign-in button styled to match the dark Sila theme. */
export default function GoogleAuthButton({ label = "المتابعة عبر Google" }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.redirected) return;
    if (result.error) {
      toast.error(friendlyAuthError(result.error));
      setLoading(false);
      return;
    }
    window.location.href = "/";
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="w-full h-11 gap-2 bg-card/50 hover:bg-card border-border/60 font-medium"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.7 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
      )}
      {label}
    </Button>
  );
}