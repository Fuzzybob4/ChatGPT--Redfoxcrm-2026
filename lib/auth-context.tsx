'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { authConfirmRedirect } from '@/lib/auth-link-origin';

export interface User {
  id: string;
  email: string;
  name: string;
  locationId: string;
  plan: 'starter' | 'professional' | 'enterprise';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    locationName: string,
    extra?: Record<string, string>,
  ) => Promise<{ hasSession: boolean }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function supabaseUserToUser(sbUser: { id: string; email?: string; user_metadata?: Record<string, string> }): User {
  return {
    id: sbUser.id,
    email: sbUser.email ?? '',
    name: sbUser.user_metadata?.full_name ?? sbUser.email?.split('@')[0] ?? 'User',
    locationId: sbUser.user_metadata?.location_id ?? 'loc-1',
    plan: (sbUser.user_metadata?.plan as User['plan']) ?? 'starter',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user: sbUser } }) => {
      setUser(sbUser ? supabaseUserToUser(sbUser) : null);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? supabaseUserToUser(session.user) : null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.user) setUser(supabaseUserToUser(data.user));
  };

  const signup = async (
    name: string,
    email: string,
    password: string,
    locationName: string,
    extra?: Record<string, string>,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // /auth/confirm verifies token_hash in any browser. PKCE ?code= still works
        // as a fallback. Preview emails stay on that preview; production stays on https.
        emailRedirectTo: await authConfirmRedirect('/onboarding'),
        data: {
          full_name: name,
          location_name: locationName,
          plan: 'starter',
          ...extra,
        },
      },
    });
    if (error) throw new Error(error.message);
    // A user object is returned even when email confirmation is still required.
    // Only a session means they are signed in and can continue to onboarding.
    const hasSession = Boolean(data.session);
    if (data.session?.user) setUser(supabaseUserToUser(data.session.user));
    return { hasSession };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
