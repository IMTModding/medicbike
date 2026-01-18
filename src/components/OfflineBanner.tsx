import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OfflineBannerProps {
  cacheTimestamp: string | null;
  onRefresh: () => void;
}

const OfflineBanner = ({ cacheTimestamp, onRefresh }: OfflineBannerProps) => {
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'jamais';
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
          <WifiOff className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm text-foreground">Mode hors-ligne</p>
          <p className="text-xs text-muted-foreground">
            Données mises en cache le {formatTimestamp(cacheTimestamp)}
          </p>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onRefresh}
          className="text-amber-600 border-amber-500/30"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default OfflineBanner;
