import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Monitor, Smartphone, Tablet, MapPin, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface LoginHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LoginRecord {
  id: string;
  login_at: string;
  device_type: string | null;
  location: string | null;
  user_agent: string | null;
}

const getDeviceIcon = (deviceType: string | null) => {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="w-4 h-4" />;
    case 'tablet':
      return <Tablet className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
};

const getDeviceLabel = (deviceType: string | null) => {
  switch (deviceType) {
    case 'mobile':
      return 'Mobile';
    case 'tablet':
      return 'Tablette';
    default:
      return 'Ordinateur';
  }
};

const LoginHistoryDialog = ({ open, onOpenChange }: LoginHistoryDialogProps) => {
  const [history, setHistory] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('login_history')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching login history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Historique des connexions</DialogTitle>
          <DialogDescription>
            Vos 20 dernières connexions
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg border border-border">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun historique de connexion</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record, index) => (
                <div 
                  key={record.id} 
                  className={`flex gap-3 p-3 rounded-lg border ${
                    index === 0 ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {getDeviceIcon(record.device_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm text-foreground">
                        {getDeviceLabel(record.device_type)}
                        {index === 0 && (
                          <span className="ml-2 text-xs text-primary">(Actuelle)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {format(new Date(record.login_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </span>
                    </div>
                    {record.location && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <MapPin className="w-3 h-3" />
                        <span>{record.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LoginHistoryDialog;
