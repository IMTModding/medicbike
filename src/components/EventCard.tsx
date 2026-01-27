import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  Check, 
  X, 
  HelpCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileDown
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Event, useEventAvailabilities, useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { exportEventPDF } from '@/utils/pdfExport';
import { toast } from 'sonner';

interface EventCardProps {
  event: Event;
  profiles?: Map<string, { full_name: string | null; avatar_url: string | null }>;
}

export function EventCard({ event, profiles }: EventCardProps) {
  const { user, isAdmin, isCreator } = useAuth();
  const { deleteEvent } = useEvents();
  const { availabilities, myAvailability, setAvailability, loading } = useEventAvailabilities(event.id);
  const [expanded, setExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const eventDate = parseISO(event.event_date);
  const isUpcoming = isAfter(eventDate, new Date()) || isToday(eventDate);
  const isPast = isBefore(eventDate, new Date()) && !isToday(eventDate);
  
  // Creators can manage ANY event, admins can manage their organization's events
  const canManage = isCreator || isAdmin;

  const availableCount = availabilities.filter(a => a.status === 'available').length;
  const maybeCount = availabilities.filter(a => a.status === 'maybe').length;
  const unavailableCount = availabilities.filter(a => a.status === 'unavailable').length;

  const handleDelete = async () => {
    setDeleting(true);
    await deleteEvent(event.id);
    setDeleting(false);
    setDeleteDialogOpen(false);
  };

  const handleExportPDF = () => {
    try {
      // Convert availabilities to the format expected by exportEventPDF
      const availabilitiesForExport = availabilities.map(a => ({
        user_id: a.user_id,
        status: a.status as 'available' | 'maybe' | 'unavailable',
        notes: a.notes
      }));
      
      exportEventPDF(event, availabilitiesForExport, profiles || new Map());
      toast.success('PDF exporté avec succès');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erreur lors de l\'export PDF');
    }
  };

  const getStatusBadge = () => {
    switch (event.status) {
      case 'upcoming':
        return <Badge variant="default" className="bg-blue-500">À venir</Badge>;
      case 'ongoing':
        return <Badge variant="default" className="bg-green-500">En cours</Badge>;
      case 'completed':
        return <Badge variant="secondary">Terminé</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return null;
    }
  };

  const getMyStatusButton = (status: 'available' | 'maybe' | 'unavailable') => {
    const isSelected = myAvailability?.status === status;
    const configs = {
      available: {
        icon: Check,
        label: 'Dispo',
        className: isSelected ? 'bg-green-500 hover:bg-green-600 text-white' : 'hover:bg-green-100 hover:text-green-700',
      },
      maybe: {
        icon: HelpCircle,
        label: 'Peut-être',
        className: isSelected ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : 'hover:bg-yellow-100 hover:text-yellow-700',
      },
      unavailable: {
        icon: X,
        label: 'Indispo',
        className: isSelected ? 'bg-red-500 hover:bg-red-600 text-white' : 'hover:bg-red-100 hover:text-red-700',
      },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <Button
        size="sm"
        variant={isSelected ? 'default' : 'outline'}
        className={cn('gap-1', config.className)}
        onClick={() => setAvailability(status)}
        disabled={loading || isPast}
      >
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </Button>
    );
  };

  const getProfileInfo = (userId: string) => {
    return profiles?.get(userId) || { full_name: 'Utilisateur', avatar_url: null };
  };

  return (
    <>
      <Card className={cn(
        'transition-all',
        isPast && 'opacity-60',
        event.status === 'cancelled' && 'border-destructive/50'
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {getStatusBadge()}
                <span className="text-sm text-muted-foreground">
                  {format(eventDate, 'EEEE d MMMM yyyy', { locale: fr })}
                </span>
              </div>
              <CardTitle className="text-lg line-clamp-2">{event.title}</CardTitle>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button 
                size="icon" 
                variant="ghost" 
                className="text-muted-foreground hover:text-foreground"
                onClick={handleExportPDF}
                title="Exporter en PDF"
              >
                <FileDown className="h-4 w-4" />
              </Button>
              {canManage && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Info row */}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                {event.start_time.slice(0, 5)}
                {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
              </span>
            </div>
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{event.location}</span>
              </div>
            )}
          </div>

          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Availability summary */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-green-600 font-medium">{availableCount} dispo</span>
              {maybeCount > 0 && (
                <span className="text-yellow-600">• {maybeCount} peut-être</span>
              )}
              {unavailableCount > 0 && (
                <span className="text-red-600">• {unavailableCount} indispo</span>
              )}
            </div>
          </div>

          {/* My availability buttons */}
          {!isPast && event.status !== 'cancelled' && (
            <div className="flex flex-wrap gap-2">
              {getMyStatusButton('available')}
              {getMyStatusButton('maybe')}
              {getMyStatusButton('unavailable')}
            </div>
          )}

          {/* Expandable participants list */}
          {availabilities.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                <span>Voir les participants ({availabilities.length})</span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              
              {expanded && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {availabilities.map((a) => {
                    const profile = getProfileInfo(a.user_id);
                    const statusConfig = {
                      available: { icon: Check, color: 'text-green-600', bg: 'bg-green-100' },
                      maybe: { icon: HelpCircle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
                      unavailable: { icon: X, color: 'text-red-600', bg: 'bg-red-100' },
                    };
                    const config = statusConfig[a.status];
                    const Icon = config.icon;

                    return (
                      <div 
                        key={a.id} 
                        className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {profile.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm truncate">
                          {profile.full_name || 'Utilisateur'}
                          {a.user_id === user?.id && ' (vous)'}
                        </span>
                        <div className={cn('p-1 rounded', config.bg)}>
                          <Icon className={cn('h-4 w-4', config.color)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer l'événement"
        description={`Êtes-vous sûr de vouloir supprimer "${event.title}" ? Cette action est irréversible.`}
        confirmLabel={deleting ? 'Suppression...' : 'Supprimer'}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}
