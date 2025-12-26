
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabase';
import { createClient } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ data?: any; error: any }>;
  signUp: (email: string, pass: string, name: string, role: Role) => Promise<{ data?: any; error: any }>;
  resetPassword: (email: string) => Promise<{ data?: any; error: any }>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePassword: (password: string, oldPassword?: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  hasPermission: (allowedRoles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      // Check Supabase active session
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session?.user) {
           await fetchProfile(session.user.id, session.user.email ?? "");
        } else {
           setLoading(false);
        }
      } catch (err) {
        console.error("Auth session check failed:", err);
        setLoading(false);
      }
    };

    initAuth();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
           if (user?.id !== session.user.id) {
              await fetchProfile(session.user.id, session.user.email ?? "");
           }
        } else if (event === 'SIGNED_OUT') {
           setUser(null);
           setLoading(false);
        } else if (event === 'PASSWORD_RECOVERY') {
           // Handle password recovery event if needed, usually redirect handles it
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async (userId: string, email: string): Promise<boolean> => {
    try {
      if (!supabase) {
          setLoading(false);
          return false;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
          // Graceful fallback for missing profile/table
          if (error.code === '42P01' || error.message.includes('does not exist') || error.code === 'PGRST116') {
              console.warn("Profile/Table missing. Using session metadata.");
              const { data: { session } } = await supabase.auth.getSession();
              const meta = session?.user?.user_metadata || {};
              
              setUser({
                  id: userId,
                  email: email,
                  name: meta.display_name || meta.name || email.split('@')[0],
                  role: (meta.role as Role) || 'cashier',
                  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
              });
              return true;
          }
          console.error("Profile fetch error:", error);
          return false;
      }

      if (!data) {
        setUser(null);
        return false;
      }

      setUser({
        id: userId,
        email: email,
        name: data.name,
        role: data.role as Role,
        avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`
      });
      return true;

    } catch (e) {
      console.error("Unexpected profile fetch error:", e);
      setUser({
          id: userId,
          email: email,
          name: email.split('@')[0],
          role: 'cashier',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
      });
      return true;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, pass: string) => {
    if (!supabase) return { error: { message: "Supabase client not initialized" } };
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    
    if (data.user && !error) {
       await fetchProfile(data.user.id, data.user.email ?? "");
    }

    return { data, error };
  };

  const signUp = async (email: string, pass: string, name: string, role: Role) => {
    if (!supabase) return { error: { message: "Supabase client not initialized" } };
    
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    let authClient = supabase;
    
    // If admin is creating user, use isolated client to not kill admin session
    if (currentSession) {
        authClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
    }
    
    const { data, error } = await authClient.auth.signUp({
      email,
      password: pass,
      options: { data: { display_name: name, role: role } }
    });

    if (error) return { error };

    if (data.user) {
        const dbClient = currentSession ? supabase : authClient;
        const createProfileWithRetry = async (maxRetries = 3): Promise<any> => {
            let lastError: any = null;
            await new Promise(r => setTimeout(r, 500));
            for (let i = 0; i < maxRetries; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 500 * Math.pow(2, i - 1)));
                const { error: profileError } = await dbClient.from('profiles').upsert({
                    id: data.user!.id, email: email, name: name, role: role,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
                });
                if (!profileError) return null;
                if (profileError.code === '42P01') return null; // Table missing, ignore
                lastError = profileError;
                if (profileError.code !== '23503') return profileError;
            }
            return lastError;
        };
        await createProfileWithRetry();
    }

    return { data, error: null };
  };

  const resetPassword = async (email: string) => {
      if (!supabase) return { error: { message: "Supabase client not initialized" } };
      // Redirect to a specific URL after clicking the email link
      // In a hash router SPA, usually just root is fine, the user will be logged in by Supabase automatically
      return await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/#/settings' 
      });
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user || !supabase) return;

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
    if (error && error.code !== '42P01') {
        throw error;
    }
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const updatePassword = async (password: string, oldPassword?: string) => {
      if (!supabase) return { error: { message: "Client not initialized" } };
      
      if (oldPassword && user?.email) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
              email: user.email,
              password: oldPassword
          });
          if (signInError) return { error: { message: "Old password verification failed." } };
      }

      const { error } = await supabase.auth.updateUser({ password });
      return { error };
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  };

  const hasPermission = (allowedRoles: Role[]) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, resetPassword, updateProfile, updatePassword, logout, isAuthenticated: !!user, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
