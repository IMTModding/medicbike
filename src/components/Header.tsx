import { Bell, LogOut, LayoutDashboard, History, MapPin, BarChart3, Calendar, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificationToggle } from '@/components/NotificationToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const { signOut, role, isAdmin } = useAuth();
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
              {isAdmin ? 'Administrateur' : 'Alertes en cours'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <NotificationToggle />
          
          {/* Quick access buttons */}
          <button 
            onClick={() => navigate('/map')}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent"
            title="Carte"
          >
            <MapPin className="w-5 h-5 text-foreground" />
          </button>
          
          <button 
            onClick={() => navigate('/stats')}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent"
            title="Statistiques"
          >
            <BarChart3 className="w-5 h-5 text-foreground" />
          </button>

          {/* Menu dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent"
                title="Menu"
              >
                <User className="w-5 h-5 text-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-2" />
                Mon profil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/availability')}>
                <Calendar className="w-4 h-4 mr-2" />
                Mes disponibilités
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/history')}>
                <History className="w-4 h-4 mr-2" />
                Historique
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard admin
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
