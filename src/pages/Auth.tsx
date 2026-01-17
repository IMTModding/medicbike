import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Mail, Lock, User, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const emailSchema = z.string().email('Email invalide');
const passwordSchema = z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères');

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [codeValidated, setCodeValidated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  
  const { signIn, signUp, validateInviteCode } = useAuth();
  const navigate = useNavigate();

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
        
        const { error } = await signUp(email, password, fullName, inviteCode);
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
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
          <Bell className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-bold text-xl text-foreground">Interventions</h1>
          <p className="text-xs text-muted-foreground">Système d'alertes</p>
        </div>
      </div>

      {/* Form Card */}
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
    </div>
  );
};

export default Auth;
