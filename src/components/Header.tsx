import { Bell, LogOut, LayoutDashboard, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificationToggle } from '@/components/NotificationToggle';

export const Header = () => {
  const { signOut, role } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">Interventions</h1>
            <p className="text-xs text-muted-foreground">
              {role === 'admin' ? 'Administrateur' : 'Alertes en cours'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <NotificationToggle />
          <button 
            onClick={() => navigate('/history')}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent"
            title="Historique"
          >
            <History className="w-5 h-5 text-foreground" />
          </button>
          {role === 'admin' && (
            <button 
              onClick={() => navigate('/admin')}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent"
              title="Dashboard admin"
            >
              <LayoutDashboard className="w-5 h-5 text-foreground" />
            </button>
          )}
          <button 
            onClick={handleSignOut}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent"
            title="Déconnexion"
          >
            <LogOut className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
};
