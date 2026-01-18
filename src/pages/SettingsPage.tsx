import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { ArrowLeft, Moon, Sun, Bell, User, Shield, LogOut, History, RefreshCw, Smartphone, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';
import LoginHistoryDialog from '@/components/LoginHistoryDialog';
import TwoFactorSetup from '@/components/TwoFactorSetup';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { toast } from 'sonner';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const { isEnabled: is2FAEnabled, loading: loading2FA, disable2FA, refresh: refresh2FA } = useTwoFactor();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleDisable2FA = async () => {
    const result = await disable2FA();
    if (result.success) {
      toast.success('2FA désactivé');
    } else {
      toast.error('Erreur lors de la désactivation');
    }
  };

  const handleResetOnboarding = () => {
    localStorage.removeItem('onboarding_completed');
    window.location.reload();
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center gap-4 h-16 px-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-lg text-foreground">Paramètres</h1>
            <p className="text-xs text-muted-foreground">Préférences de l'application</p>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Apparence */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            Apparence
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Mode sombre</p>
                <p className="text-xs text-muted-foreground">Activer le thème sombre</p>
              </div>
              <Switch 
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Push notifications</p>
                <p className="text-xs text-muted-foreground">Recevoir les alertes d'intervention</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
                Configurer
              </Button>
            </div>
          </div>
        </div>

        {/* Compte */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Compte
          </h2>
          
          <div className="space-y-3">
            <Button 
              variant="secondary" 
              className="w-full justify-start"
              onClick={() => navigate('/profile')}
            >
              <User className="w-4 h-4 mr-2" />
              Mon profil
            </Button>
            
            {isAdmin && (
              <Button 
                variant="secondary" 
                className="w-full justify-start"
                onClick={() => navigate('/admin')}
              >
                <Shield className="w-4 h-4 mr-2" />
                Dashboard admin
              </Button>
            )}
          </div>
        </div>

        {/* Sécurité */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Sécurité
          </h2>
          
          <div className="space-y-3">
            <Button 
              variant="secondary" 
              className="w-full justify-start"
              onClick={() => setShowLoginHistory(true)}
            >
              <History className="w-4 h-4 mr-2" />
              Historique des connexions
            </Button>

            {/* 2FA Section */}
            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${is2FAEnabled ? 'bg-green-500/20 text-green-500' : 'bg-muted'}`}>
                  {is2FAEnabled ? <ShieldCheck className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Authentification 2FA</p>
                  <p className="text-xs text-muted-foreground">
                    {is2FAEnabled ? 'Activée - Protection renforcée' : 'Désactivée'}
                  </p>
                </div>
              </div>
              {loading2FA ? (
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              ) : is2FAEnabled ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDisable2FA}
                  className="text-destructive border-destructive/50"
                >
                  <ShieldOff className="w-4 h-4 mr-1" />
                  Désactiver
                </Button>
              ) : (
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShow2FASetup(true)}
                >
                  Configurer
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Aide */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Aide
          </h2>
          
          <div className="space-y-3">
            <Button 
              variant="secondary" 
              className="w-full justify-start"
              onClick={handleResetOnboarding}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Revoir le tutoriel
            </Button>
          </div>
        </div>

        <Separator />

        {/* Déconnexion */}
        <Button 
          variant="destructive" 
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Déconnexion
        </Button>

        {/* Version */}
        <p className="text-center text-xs text-muted-foreground">
          MEDICBIKE v1.0.0
        </p>
      </main>

      {/* Login History Dialog */}
      <LoginHistoryDialog 
        open={showLoginHistory} 
        onOpenChange={setShowLoginHistory} 
      />

      {/* 2FA Setup Dialog */}
      <TwoFactorSetup 
        open={show2FASetup} 
        onOpenChange={setShow2FASetup}
        onSuccess={refresh2FA}
      />
    </div>
  );
};

export default SettingsPage;
