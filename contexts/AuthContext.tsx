import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasPermission: (allowedRoles: Role[]) => boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, name: string, role: Role) => Promise<any>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<any>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  updatePassword: (newPassword: string, oldPassword?: string) => Promise<any>;
  loginAsDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string) => {
    if (!supabase) return;
    try {
      // Use a simple timeout for profile fetch to prevent lingering requests
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      const result: any = await Promise.race([fetchPromise, timeoutPromise]);
      const { data, error } = result;
      
      if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
      }

      if (data) {
         setUser(prev => {
            // Only update if the user ID still matches (avoid race condition with logout)
            if (!prev || prev.id !== userId) return prev;
            return {
                ...prev,
                name: data.full_name || prev.name,
                role: (data.role || 'cashier').toLowerCase() as Role,
                avatar: data.avatar_url || prev.avatar
            };
         });
      }
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // Safety guard: If supabase client isn't available, stop loading immediately.
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        // Create a timeout promise to enforce bootstrap completion
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Auth initialization timeout')), 3000)
        );

        // Race the session check against the timeout
        // This ensures the app never gets stuck in a loading state if Supabase hangs
        const sessionPromise = supabase.auth.getSession();
        
        const result: any = await Promise.race([sessionPromise, timeoutPromise]);
        const { data: { session }, error } = result;

        if (error) throw error;
        
        if (session?.user && mounted) {
           const meta = session.user.user_metadata || {};
           // Optimistic User Set
           setUser({
               id: session.user.id,
               email: session.user.email ?? "",
               name: meta.display_name || meta.name || session.user.email?.split('@')[0] || "User",
               role: (meta.role || 'cashier').toLowerCase() as Role,
               avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`
           });
           
           // We do NOT await this in the critical path to ensure UI renders ASAP.
           // Profile updates will flow in reactively.
           fetchProfile(session.user.id, session.user.email ?? "");
        }
      } catch (err) {
        console.warn("Auth bootstrap warning:", err);
        // Even if auth fails or times out, we assume unauthenticated state 
        // to allow the app to render (and likely redirect to Login).
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;

        if (session?.user) {
             const meta = session.user.user_metadata || {};
             setUser(prev => {
                if (prev?.id === session.user.id) return prev;
                return {
                    id: session.user.id,
                    email: session.user.email ?? "",
                    name: meta.display_name || meta.name || session.user.email?.split('@')[0] || "User",
                    role: (meta.role || 'cashier').toLowerCase() as Role,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`
                };
             });
             
             // Ensure loading is false if auth state changes late
             setLoading(false); 
             fetchProfile(session.user.id, session.user.email ?? "");
        } else {
             setUser(null);
             setLoading(false);
        }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (allowedRoles: Role[]): boolean => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase client not initialized");
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, name: string, role: Role) => {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                display_name: name,
                role: role,
                full_name: name
            }
        }
    });
    return { data, error };
  };

  const logout = async () => {
    if (!supabase) return;
    setLoading(true); // Briefly show loading state during logout
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.error("Logout error", e);
    } finally {
        setUser(null);
        setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!supabase) throw new Error("Supabase client not initialized");
    return await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/#/?reset=true'
    });
  };

  const updateProfile = async (updates: Partial<User>) => {
      if (!supabase || !user) return;
      try {
          if (updates.name) {
              await supabase.auth.updateUser({
                  data: { display_name: updates.name }
              });
          }

          const profileUpdates: any = {};
          if (updates.name) profileUpdates.full_name = updates.name;
          if (updates.avatar) profileUpdates.avatar_url = updates.avatar;

          if (Object.keys(profileUpdates).length > 0) {
              const { error } = await supabase
                .from('profiles')
                .update(profileUpdates)
                .eq('id', user.id);
              if (error) throw error;
          }

          setUser(prev => prev ? { ...prev, ...updates } : null);
      } catch (err) {
          console.error("Update profile failed:", err);
          throw err;
      }
  };

  const updatePassword = async (newPassword: string, oldPassword?: string) => {
      if (!supabase) throw new Error("Supabase client not initialized");
      return await supabase.auth.updateUser({ password: newPassword });
  };

  const loginAsDemo = async () => {
      setLoading(true);
      // Simulate network delay slightly for realism, then resolve
      setTimeout(() => {
          setUser({
              id: 'demo-user-123',
              email: 'demo@ecopos.com',
              name: 'Demo Manager',
              role: 'manager',
              avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo'
          });
          setLoading(false);
      }, 800);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      hasPermission,
      signIn,
      signUp,
      logout,
      resetPassword,
      updateProfile,
      updatePassword,
      loginAsDemo
    }}>
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