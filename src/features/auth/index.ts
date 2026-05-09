// Public API — Auth feature
export { default as AuthGuard } from "./components/AuthGuard";
export { default as AuthForm } from "./components/AuthForm";
export { AuthProvider, useAuth } from "./hooks/use-auth";
export type { UserRole } from "./hooks/use-auth";
