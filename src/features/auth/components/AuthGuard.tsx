import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
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
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Intercept the browser/device back button on protected pages so users don't
  // accidentally log themselves out by swiping back to /login.
  useEffect(() => {
    if (!user) return;

    window.history.pushState({ __silaGuard: true }, "");

    const onPopState = () => {
      window.history.pushState({ __silaGuard: true }, "");
      setConfirmOpen(true);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [user]);

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
      {children}
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
