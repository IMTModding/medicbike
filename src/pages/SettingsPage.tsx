import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { ArrowLeft, Moon, Sun, Bell, User, Shield, LogOut, History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';
import LoginHistoryDialog from '@/components/LoginHistoryDialog';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, signOut, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);

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

  const handleResetOnboarding = () => {
    // This would reset onboarding to show again
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
    </div>
  );
};

export default SettingsPage;
