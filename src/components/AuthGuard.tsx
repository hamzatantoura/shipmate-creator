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

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard
    const redirectMap: Record<UserRole, string> = {
      merchant: "/merchant",
      vendor: "/vendor",
      admin: "/admin",
    };
    return <Navigate to={redirectMap[role] || "/login"} replace />;
  }

  return <>{children}</>;
}
