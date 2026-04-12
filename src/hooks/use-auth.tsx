import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type UserRole = "admin" | "merchant" | "vendor";

interface AuthState {
  user: User | null;
  role: UserRole | null;
  profile: {
    store_name: string | null;
    contact_person: string | null;
    phone: string | null;
    city: string | null;
  } | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "signOut">>({
    user: null,
    role: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    const fetchProfile = async (user: User) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setState({
        user,
        role: (profile?.role as UserRole) || "merchant",
        profile: profile
          ? {
              store_name: profile.store_name,
              contact_person: profile.contact_person,
              phone: profile.phone,
              city: profile.city,
            }
          : null,
        loading: false,
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await fetchProfile(session.user);
        } else {
          setState({ user: null, role: null, profile: null, loading: false });
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await fetchProfile(session.user);
      } else {
        setState({ user: null, role: null, profile: null, loading: false });
      }
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
