import { useState, useEffect } from 'react';
import { LogOut, LayoutDashboard, History, BarChart3, User, KeyRound, Users, MessageCircle, Newspaper, Settings, Home } from 'lucide-react';
import logo from '@/assets/logo.jpg';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificationToggle } from '@/components/NotificationToggle';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Header = () => {
  const { signOut, role, isAdmin, user, isCreator } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const roleLabel = isCreator ? 'Créateur' : isAdmin ? 'Admin' : role ? role : 'Alertes';

  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };
    
    fetchAvatar();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-background/95 via-card/90 to-background/95 backdrop-blur-lg border-b border-border/50 safe-top shadow-lg shadow-black/10">
      <div className="container flex items-center justify-between h-14 sm:h-16 px-4 gap-2">
        {/* Logo and title - fixed width */}
        <div className="flex items-center gap-2 shrink-0">
          <img src={logo} alt="MEDICBIKE Logo" className="w-9 h-9 rounded-full object-cover" />
          <div>
            <h1 className="font-bold text-sm sm:text-base text-foreground leading-tight">MEDICBIKE</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {roleLabel}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-1.5">
          <button 
            onClick={() => navigate('/')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary flex items-center justify-center transition-colors hover:bg-primary/90 shrink-0"
            title="Accueil"
          >
            <Home className="w-4 h-4 text-primary-foreground" />
          </button>
          
          <NotificationToggle />
          
          <button 
            onClick={() => navigate('/news')}
            className="hidden sm:flex w-9 h-9 rounded-full bg-secondary items-center justify-center transition-colors hover:bg-accent shrink-0"
            title="Actualités"
          >
            <Newspaper className="w-4 h-4 text-foreground" />
          </button>
          
          <button 
            onClick={() => navigate('/general-chat')}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent shrink-0"
            title="Chat général"
          >
            <MessageCircle className="w-4 h-4 text-foreground" />
          </button>
          
          
          <button 
            onClick={() => navigate('/stats')}
            className="hidden sm:flex w-9 h-9 rounded-full bg-secondary items-center justify-center transition-colors hover:bg-accent shrink-0"
            title="Statistiques"
          >
            <BarChart3 className="w-4 h-4 text-foreground" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent overflow-hidden shrink-0"
                title="Menu"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-foreground" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-2" />
                Mon profil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/history')}>
                <History className="w-4 h-4 mr-2" />
                Historique
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/news')} className="sm:hidden">
                <Newspaper className="w-4 h-4 mr-2" />
                Actualités
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/stats')} className="sm:hidden">
                <BarChart3 className="w-4 h-4 mr-2" />
                Statistiques
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard admin
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/employees')}>
                    <Users className="w-4 h-4 mr-2" />
                    Mes employés
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/invite-codes')}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    Codes d'invitation
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </DropdownMenuItem>
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
