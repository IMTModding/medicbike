import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { recordLogin } from '@/hooks/useLoginHistory';
import logo from '@/assets/logo.jpg';

type UserRole = 'admin' | 'employee';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string, inviteCode: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  validateInviteCode: (code: string) => Promise<{ valid: boolean; organizationName?: string; adminId?: string; codeId?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const fetchUserRole = async (userId: string) => {
    console.log('Fetching role for user:', userId);
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    console.log('Role fetch result:', { data, error });
    
    if (data) {
      console.log('Setting role to:', data.role);
      setRole(data.role as UserRole);
    } else {
      console.log('No role found for user');
    }
  };

  useEffect(() => {
    let isMounted = true;

    // If auth init hangs (offline, blocked third-party storage, etc.), don't keep users stuck.
    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      setInitError('Impossible de se connecter au service. Vérifiez votre connexion internet puis réessayez.');
      setLoading(false);
    }, 8000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer backend calls with setTimeout
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
        }
      }
    );

    (async () => {
      try {
        // THEN check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        window.clearTimeout(timeoutId);
        setInitError(null);

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchUserRole(session.user.id);
        }
      } catch (e) {
        if (!isMounted) return;
        setInitError('Erreur lors de l\'initialisation. Réessayez.');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const validateInviteCode = async (code: string) => {
    // Use secure server-side function to validate code without exposing all codes
    const { data, error } = await supabase
      .rpc('validate_invite_code', { code_to_validate: code });
    
    if (error || !data || data.length === 0 || !data[0].is_valid) {
      return { valid: false };
    }
    
    const result = data[0];
    return { 
      valid: true, 
      organizationName: result.organization_name,
      adminId: result.admin_id,
      codeId: result.code_id
    };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string, inviteCode: string) => {
    // Validate invite code first
    const codeValidation = await validateInviteCode(inviteCode);
    if (!codeValidation.valid) {
      return { error: new Error('Code d\'invitation invalide ou expiré') };
    }
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });
    
    if (error) {
      return { error };
    }
    
    // Update profile with invite code, admin link and phone
    if (data.user) {
      await supabase
        .from('profiles')
        .update({
          invite_code_id: codeValidation.codeId,
          admin_id: codeValidation.adminId,
          phone: phone,
        })
        .eq('user_id', data.user.id);
    }
    
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Record login on successful sign in
    if (!error && data.user) {
      recordLogin(data.user.id);
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  const isAdmin = role === 'admin';

  // If auth initialization failed (timeout/offline), show a clear retry screen
  if (initError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="flex flex-col items-center gap-3">
          <img
            src={logo}
            alt="MEDICBIKE"
            className="w-20 h-20 rounded-full object-cover shadow-lg"
          />
          <div className="text-center">
            <h1 className="font-bold text-xl text-foreground">MEDICBIKE</h1>
            <p className="text-sm text-muted-foreground">Unité Médicale Motocycliste</p>
          </div>
        </div>

        <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 animate-fade-in">
          <p className="text-sm text-foreground mb-4">{initError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover-scale"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Block rendering until auth is initialized to prevent infinite loops
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <img 
            src={logo} 
            alt="MEDICBIKE" 
            className="w-24 h-24 rounded-full object-cover shadow-lg animate-pulse"
          />
          <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-ping" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-bold text-xl text-foreground">MEDICBIKE</h1>
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, role, isAdmin, signUp, signIn, signOut, validateInviteCode }}>
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
