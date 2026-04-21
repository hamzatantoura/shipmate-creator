import { Navigate } from "react-router-dom";
import { useAuth, type UserRole } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, role, loading } = useAuth();

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

  return <>{children}</>;
}
