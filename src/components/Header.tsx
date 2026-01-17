import { Bell, User } from 'lucide-react';

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-foreground">Interventions</h1>
            <p className="text-xs text-muted-foreground">Alertes en cours</p>
          </div>
        </div>
        
        <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-colors hover:bg-accent">
          <User className="w-5 h-5 text-foreground" />
        </button>
      </div>
    </header>
  );
};
