import { useEffect, useState } from "react";
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
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          // Fetch profile with role
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", session.user.id)
            .single();

          setState({
            user: session.user,
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
        } else {
          setState({ user: null, role: null, profile: null, loading: false });
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        setState({
          user: session.user,
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
      } else {
        setState({ user: null, role: null, profile: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
