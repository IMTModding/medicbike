import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, User, AlertCircle, KeyRound, CheckCircle2, ArrowLeft, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpg';
import { resetPWAAndReload } from '@/lib/pwaReset';

const emailSchema = z.string().email('Email invalide');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');
const phoneSchema = z.string().min(10, 'Numéro de téléphone invalide').regex(/^[0-9+\s-]+$/, 'Format de téléphone invalide');

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [codeValidated, setCodeValidated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const { signIn, signUp, validateInviteCode } = useAuth();
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (error) {
      setError(error.message);
    } else {
      setResetEmailSent(true);
      toast.success('Email de réinitialisation envoyé !');
    }
    
    setLoading(false);
  };

  const handleValidateCode = async () => {
    if (!inviteCode.trim()) {
      setError('Veuillez entrer un code d\'invitation');
      return;
    }
    
    setValidatingCode(true);
    setError('');
    
    const result = await validateInviteCode(inviteCode);
    
    if (result.valid) {
      setCodeValidated(true);
      setOrganizationName(result.organizationName || '');
      toast.success(`Code valide ! Organisation: ${result.organizationName}`);
    } else {
      setError('Code d\'invitation invalide ou expiré');
    }
    
    setValidatingCode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (!isLogin) {
        phoneSchema.parse(phone);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        return;
      }
    }
    
    if (!isLogin && !codeValidated) {
      setError('Veuillez d\'abord valider votre code d\'invitation');
      return;
    }
    
    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Email ou mot de passe incorrect');
          } else {
            setError(error.message);
          }
        } else {
          toast.success('Connexion réussie !');
          navigate('/');
        }
      } else {
        if (!fullName.trim()) {
          setError('Le nom complet est requis');
          setLoading(false);
          return;
        }
        
        if (!phone.trim()) {
          setError('Le numéro de téléphone est requis');
          setLoading(false);
          return;
        }
        
        const { error } = await signUp(email, password, fullName, phone, inviteCode);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('Cet email est déjà utilisé');
          } else {
            setError(error.message);
          }
        } else {
          toast.success('Compte créé avec succès !');
          navigate('/');
        }
      }
    } catch (err) {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Reset PWA (helps when an old cached version blocks the app) */}
      <div className="w-full max-w-sm mb-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => resetPWAAndReload()}
        >
          Réinitialiser l’application
        </Button>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Si la PWA est bloquée, cela vide le cache et redémarre.
        </p>
      </div>

      {/* Forgot Password Form */}
      {isForgotPassword ? (
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6">
          <button
            type="button"
            onClick={() => {
              setIsForgotPassword(false);
              setResetEmailSent(false);
              setError('');
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          
          <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
            Mot de passe oublié
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Entrez votre email pour recevoir un lien de réinitialisation
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {resetEmailSent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-center text-muted-foreground">
                Un email de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte de réception.
              </p>
              <Button
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetEmailSent(false);
                }}
                className="w-full"
              >
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 bg-secondary border-border"
                />
              </div>

              <Button
                type="submit"
                size="xl"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
              </Button>
            </form>
          )}
        </div>
      ) : (
      /* Form Card */
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border p-6">
        <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
          {isLogin ? 'Connexion' : 'Créer un compte'}
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {isLogin 
            ? 'Connectez-vous pour voir les alertes' 
            : 'Inscrivez-vous pour commencer'}
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg p-3 mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              {/* Invite Code Section */}
              <div className="space-y-2">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Code d'invitation"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value.toUpperCase());
                        setCodeValidated(false);
                      }}
                      className="pl-10 h-12 bg-secondary border-border uppercase"
                      maxLength={6}
                      disabled={codeValidated}
                    />
                  </div>
                  {!codeValidated ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-12 px-4"
                      onClick={handleValidateCode}
                      disabled={validatingCode}
                    >
                      {validatingCode ? '...' : 'Valider'}
                    </Button>
                  ) : (
                    <div className="h-12 px-4 flex items-center text-green-500">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                </div>
                {codeValidated && (
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Organisation: {organizationName}
                  </p>
                )}
              </div>
              
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Nom complet"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-12 bg-secondary border-border"
                />
              </div>
              
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="Téléphone (ex: 06 12 34 56 78)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 h-12 bg-secondary border-border"
                />
              </div>
            </>
          )}
          
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 bg-secondary border-border"
            />
          </div>
          
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 bg-secondary border-border"
            />
          </div>

          {isLogin && (
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(true);
                setError('');
              }}
              className="text-sm text-primary hover:underline"
            >
              Mot de passe oublié ?
            </button>
          )}

          <Button
            type="submit"
            size="xl"
            className="w-full"
            disabled={loading}
          >
            {loading 
              ? 'Chargement...' 
              : isLogin ? 'Se connecter' : 'Créer le compte'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogin 
              ? "Pas de compte ? S'inscrire" 
              : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
      )}
    </div>
  );
};

export default Auth;
