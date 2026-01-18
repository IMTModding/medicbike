import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';

const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check URL hash for recovery token
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'recovery' || session) {
        setIsValidSession(true);
      }
      setCheckingSession(false);
    };
    
    checkSession();

    // Listen for auth state changes (recovery flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate password
    try {
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }
    
    // Check passwords match
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      toast.success('Mot de passe mis à jour avec succès !');
      
      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    }
    
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src={logo} alt="MEDICBIKE Logo" className="w-24 h-24 rounded-full object-cover shadow-lg" />
          <div className="text-center">
            <h1 className="font-bold text-2xl text-foreground">MEDICBIKE</h1>
            <p className="text-sm text-muted-foreground">Unité Médicale Motocycliste</p>
          </div>
        </div>
        
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Lien invalide ou expiré
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Ce lien de réinitialisation n'est plus valide. Veuillez demander un nouveau lien.
          </p>
          <Button onClick={() => navigate('/auth')} className="w-full">
            Retour à la connexion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <img src={logo} alt="MEDICBIKE Logo" className="w-24 h-24 rounded-full object-cover shadow-lg" />
        <div className="text-center">
          <h1 className="font-bold text-2xl text-foreground">MEDICBIKE</h1>
          <p className="text-sm text-muted-foreground">Unité Médicale Motocycliste</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
          Nouveau mot de passe
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Choisissez un nouveau mot de passe sécurisé
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-center text-muted-foreground">
              Votre mot de passe a été mis à jour. Redirection en cours...
            </p>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Nouveau mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 bg-secondary border-border"
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12 bg-secondary border-border"
              />
            </div>

            <Button
              type="submit"
              size="xl"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
