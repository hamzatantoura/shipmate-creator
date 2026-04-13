import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type UserRole = "admin" | "merchant" | "vendor";

interface AuthProfile {
  store_name: string | null;
  contact_person: string | null;
  phone: string | null;
  city: string | null;
}

interface AuthState {
  user: User | null;
  role: UserRole | null;
  profile: AuthProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

const ADMIN_EMAILS = new Set(["hamza.tantoura@gmail.com"]);

async function loadAuthState(user: User): Promise<Omit<AuthState, "signOut">> {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("store_name, contact_person, phone, city")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id),
  ]);

  const resolvedRole = roleRows?.[0]?.role as UserRole | undefined;
  const role = resolvedRole ?? (ADMIN_EMAILS.has(user.email ?? "") ? "admin" : null);

  return {
    user,
    role,
    profile: profile ?? null,
    loading: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "signOut">>({
    user: null,
    role: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    const syncAuthState = async (user: User | null) => {
      if (!user) {
        setState({ user: null, role: null, profile: null, loading: false });
        return;
      }

      setState((current) => ({ ...current, loading: true }));
      setState(await loadAuthState(user));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Handle token refresh failure — sign out gracefully
        if (event === "TOKEN_REFRESHED" && !session) {
          void supabase.auth.signOut();
          return;
        }
        if (event === "SIGNED_OUT") {
          setState({ user: null, role: null, profile: null, loading: false });
          return;
        }
        void syncAuthState(session?.user ?? null);
      }
    );

    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Session expired or invalid — sign out cleanly
        console.warn("Session error, signing out:", error.message);
        void supabase.auth.signOut();
        return;
      }
      void syncAuthState(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
