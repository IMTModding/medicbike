import { MapPin, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Intervention } from '@/services/interventions';
import { cn } from '@/lib/utils';

interface AlertCardProps {
  intervention: Intervention;
  onStatusChange: (id: string, status: 'available' | 'unavailable') => void;
}

const getUrgencyConfig = (urgency: Intervention['urgency']) => {
  switch (urgency) {
    case 'high':
      return {
        label: 'Urgent',
        className: 'bg-urgent/20 text-urgent border-urgent/30',
        dotClass: 'bg-urgent pulse-urgent',
      };
    case 'medium':
      return {
        label: 'Moyen',
        className: 'bg-warning/20 text-warning border-warning/30',
        dotClass: 'bg-warning',
      };
    case 'low':
      return {
        label: 'Normal',
        className: 'bg-success/20 text-success border-success/30',
        dotClass: 'bg-success',
      };
  }
};

const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  
  return `Il y a ${Math.floor(diffHours / 24)}j`;
};

export const AlertCard = ({ intervention, onStatusChange }: AlertCardProps) => {
  const urgencyConfig = getUrgencyConfig(intervention.urgency);
  const timeAgo = getTimeAgo(intervention.created_at);
  
  const isResponded = intervention.userStatus === 'available' || intervention.userStatus === 'unavailable';

  return (
    <div 
      className={cn(
        "gradient-card rounded-xl border border-border p-4 slide-up",
        intervention.urgency === 'high' && !isResponded && "border-urgent/40"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", urgencyConfig.dotClass)} />
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full border",
            urgencyConfig.className
          )}>
            {urgencyConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="w-3 h-3" />
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        {intervention.urgency === 'high' && (
          <AlertTriangle className="w-4 h-4 text-urgent" />
        )}
        {intervention.title}
      </h3>
      {intervention.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {intervention.description}
        </p>
      )}

      {/* Location */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <MapPin className="w-4 h-4 text-primary" />
        <span className="truncate">{intervention.location}</span>
      </div>

      {/* Action Buttons */}
      {isResponded ? (
        <div className={cn(
          "flex items-center justify-center gap-2 py-3 rounded-lg",
          intervention.userStatus === 'available' 
            ? "bg-success/10 text-success" 
            : "bg-muted text-muted-foreground"
        )}>
          {intervention.userStatus === 'available' ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Vous êtes disponible</span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Indisponible</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-3">
          <Button
            variant="available"
            size="xl"
            className="flex-1"
            onClick={() => onStatusChange(intervention.id, 'available')}
          >
            <CheckCircle2 />
            Dispo
          </Button>
          <Button
            variant="unavailable"
            size="xl"
            className="flex-1"
            onClick={() => onStatusChange(intervention.id, 'unavailable')}
          >
            <XCircle />
            Indisponible
          </Button>
        </div>
      )}
    </div>
  );
};
