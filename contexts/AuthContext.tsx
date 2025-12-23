import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from '../services/supabase';
import { createClient } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<{ data?: any; error: any }>;
  signUp: (email: string, pass: string, name: string, role: Role) => Promise<{ data?: any; error: any }>;
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
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 1. Check active session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session?.user) {
           // Safely handle potentially missing email
           await fetchProfile(session.user.id, session.user.email ?? "");
        } else {
           setLoading(false);
        }
      } catch (err) {
        console.error("Auth session check failed:", err);
        setLoading(false);
      }
    };

    getSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
         if (user?.id !== session.user.id) {
            await fetchProfile(session.user.id, session.user.email ?? "");
         }
      } else if (event === 'SIGNED_OUT') {
         setUser(null);
         setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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

      if (error || !data) {
        // Silent fail/Warn for console noise, but return false to handle logic
        console.warn(`Profile missing for user ${userId}. This is expected during initial account creation.`);
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
      console.error("Profile fetch error:", e);
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, pass: string) => {
    if (!supabase) return { error: { message: "Supabase client not initialized" } };
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    
    if (data.user && !error) {
       let profileFound = await fetchProfile(data.user.id, data.user.email ?? "");
       
       // SELF-HEALING: If profile missing, try to create it from metadata
       // This fixes the issue where a user is created but profile insert failed due to race condition
       if (!profileFound && data.user.user_metadata) {
           const meta = data.user.user_metadata;
           const displayName = meta.display_name || meta.name;
           const userRole = meta.role;

           if (displayName && userRole) {
               console.log("Profile missing. Attempting self-healing from metadata...");
               const { error: insertError } = await supabase.from('profiles').upsert({
                    id: data.user.id,
                    email: email,
                    name: displayName,
                    role: userRole,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`
               });
               
               if (!insertError) {
                   // Retry fetch after healing
                   profileFound = await fetchProfile(data.user.id, data.user.email ?? "");
               } else {
                   console.error("Self-healing failed:", insertError);
               }
           }
       }

       if (!profileFound) {
           await logout();
           return { data: null, error: { message: "Account profile not found. Please contact support." } };
       }
    }

    return { data, error };
  };

  const signUp = async (email: string, pass: string, name: string, role: Role) => {
    if (!supabase) return { error: { message: "Supabase client not initialized" } };
    
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    // Use isolated client for Auth to prevent signing out the current admin
    let authClient = supabase;
    if (currentSession) {
        authClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
    }
    
    // 1. Create Auth User
    const { data, error } = await authClient.auth.signUp({
      email,
      password: pass,
      options: {
          data: {
              display_name: name,
              role: role 
          }
      }
    });

    if (error) return { error };

    if (data.user) {
        // 2. Create Profile Entry with Retry Logic
        const dbClient = currentSession ? supabase : authClient;

        // Function to attempt profile creation with retries for FK violations
        const createProfileWithRetry = async (maxRetries = 3): Promise<any> => {
            let lastError: any = null;
            
            // Add a small initial delay to allow Auth trigger/transaction to propagate
            await new Promise(r => setTimeout(r, 500));

            for (let i = 0; i < maxRetries; i++) {
                // Exponential backoff
                if (i > 0) {
                   const delay = 500 * Math.pow(2, i - 1);
                   await new Promise(r => setTimeout(r, delay));
                }

                const { error: profileError } = await dbClient.from('profiles').upsert({
                    id: data.user!.id,
                    email: email,
                    name: name,
                    role: role,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
                });

                if (!profileError) {
                    return null; // Success
                }

                lastError = profileError;

                // If error is NOT Foreign Key Violation (code 23503), stop immediately.
                if (profileError.code !== '23503') {
                    return profileError;
                }
                
                // If it IS a FK violation, we retry
            }
            
            return lastError || { message: "Failed to sync profile." };
        };

        const profileError = await createProfileWithRetry();

        if (profileError) {
            // If we still fail with 23503 after retries, it is likely a duplicate email (fake user ID)
            if (profileError.code === '23503') {
                 return { error: { message: "Profile creation failed. This email address might already be registered." } };
            }
            return { error: profileError };
        }
    }

    return { data, error: null };
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user || !supabase) return;

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', user.id);
    
    if (error) throw error;

    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const updatePassword = async (password: string, oldPassword?: string) => {
      if (!supabase) return { error: { message: "Supabase client not initialized" } };
      
      // Verify old password if provided
      if (oldPassword && user?.email) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
              email: user.email,
              password: oldPassword
          });

          if (signInError) {
              return { error: { message: "Old password verification failed. Please try again." } };
          }
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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, updateProfile, updatePassword, logout, isAuthenticated: !!user, hasPermission }}>
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