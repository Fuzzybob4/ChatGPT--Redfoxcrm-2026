'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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
  signup: (name: string, email: string, password: string, locationName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('redfox_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('redfox_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Mock login - in production, call your auth API
    if (!email || !password) {
      throw new Error('Email and password required');
    }

    // Simulate API delay
    await new Promise((r) => setTimeout(r, 500));

    const mockUser: User = {
      id: 'user-1',
      email,
      name: email.split('@')[0],
      locationId: 'loc-1',
      plan: 'professional',
    };

    setUser(mockUser);
    localStorage.setItem('redfox_user', JSON.stringify(mockUser));
  };

  const signup = async (name: string, email: string, password: string, locationName: string) => {
    if (!name || !email || !password || !locationName) {
      throw new Error('All fields required');
    }

    await new Promise((r) => setTimeout(r, 500));

    const mockUser: User = {
      id: `user-${Date.now()}`,
      email,
      name,
      locationId: 'loc-1',
      plan: 'starter',
    };

    setUser(mockUser);
    localStorage.setItem('redfox_user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('redfox_user');
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
