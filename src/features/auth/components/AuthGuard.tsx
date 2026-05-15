import { useEffect, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "@/features/auth/hooks/use-auth";
import { Loader2 } from "lucide-react";
import RequirePasswordGate from "@/features/auth/components/RequirePasswordGate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, role, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Smart back-button behavior:
  // - On a sub-page (e.g. /merchant/wallet) → go back to the role's root page.
  // - On the role's root page (e.g. /merchant) → ask to confirm logout.
  const roleRoot: Record<UserRole, string> = {
    merchant: "/merchant",
    vendor: "/courier/orders",
    admin: "/admin",
  };
  const rootPath = role ? roleRoot[role] : "/";
  const isAtRoot = location.pathname === rootPath;

  useEffect(() => {
    if (!user) return;

    window.history.pushState({ __silaGuard: true }, "");

    const onPopState = () => {
      window.history.pushState({ __silaGuard: true }, "");
      if (isAtRoot) {
        setConfirmOpen(true);
      } else {
        navigate(rootPath, { replace: true });
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [user, isAtRoot, rootPath, navigate]);

  const handleConfirmLogout = async () => {
    setConfirmOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Real users (merchants/admins) must confirm their email before accessing
  // the app. Vendor accounts use synthetic @courier.sila.local emails that are
  // pre-confirmed when the admin creates them, so they bypass this gate.
  const isSyntheticVendor = (user.email ?? "").endsWith("@courier.sila.local");
  if (!user.email_confirmed_at && !isSyntheticVendor) {
    return <Navigate to="/verify-email" replace />;
  }

  // Google (and other OAuth) signups land without store info — force them
  // through the onboarding form before they can access any protected page.
  if (profile?.needs_onboarding) {
    return <Navigate to="/complete-profile" replace />;
  }

  if (allowedRoles) {
    if (!role) {
      // Role not loaded yet or missing — redirect to login
      return <Navigate to="/login" replace />;
    }
    if (!allowedRoles.includes(role)) {
      const redirectMap: Record<UserRole, string> = {
        merchant: "/merchant",
        vendor: "/courier/orders",
        admin: "/admin",
      };
      return <Navigate to={redirectMap[role] || "/login"} replace />;
    }
  }

  return (
    <>
      <RequirePasswordGate>{children}</RequirePasswordGate>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل تود تسجيل الخروج حقاً؟</AlertDialogTitle>
            <AlertDialogDescription>
              ضغطت على زر الرجوع. يمكنك البقاء في صفحتك الحالية أو تسجيل الخروج من حسابك.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تسجيل الخروج
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
