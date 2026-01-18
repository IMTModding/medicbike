import { useState, useEffect } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Plus, Trash2, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Availability {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

interface AvailabilityWithProfile extends Availability {
  profiles?: {
    full_name: string | null;
  };
}

interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

export const AvailabilityCalendar = () => {
  const { user } = useAuth();
  const [myAvailabilities, setMyAvailabilities] = useState<Availability[]>([]);
  const [allAvailabilities, setAllAvailabilities] = useState<AvailabilityWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const loadAvailabilities = async () => {
    if (!user) return;
    
    try {
      // Load my availabilities
      const { data: myData, error: myError } = await supabase
        .from('availabilities')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(new Date(), 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (myError) throw myError;
      setMyAvailabilities(myData || []);

      // Load all organization availabilities
      const { data: allData, error: allError } = await supabase
        .from('availabilities')
        .select('*')
        .gte('date', format(new Date(), 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (allError) throw allError;
      setAllAvailabilities(allData || []);
    } catch (error) {
      console.error('Error loading availabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load profile names separately since there's no foreign key
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const loadProfiles = async () => {
      const userIds = [...new Set(allAvailabilities.map(a => a.user_id))];
      if (userIds.length === 0) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      if (data) {
        const names: Record<string, string> = {};
        data.forEach(p => {
          names[p.user_id] = p.full_name || 'Anonyme';
        });
        setProfileNames(names);
      }
    };
    
    loadProfiles();
  }, [allAvailabilities]);

  useEffect(() => {
    loadAvailabilities();
  }, [user]);

  const handleAddAvailability = async () => {
    if (!user || !dateRange.from) return;

    setSaving(true);
    try {
      const startDate = startOfDay(dateRange.from);
      const endDate = dateRange.to ? startOfDay(dateRange.to) : startDate;
      
      // Get existing availabilities for the date range
      const { data: existing } = await supabase
        .from('availabilities')
        .select('date')
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      const existingDates = new Set(existing?.map(e => e.date) || []);

      // Create entries for each day in the range (skip existing)
      const entries = [];
      let currentDate = startDate;
      
      while (currentDate <= endDate) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        if (!existingDates.has(dateStr)) {
          entries.push({
            user_id: user.id,
            date: dateStr,
            start_time: '08:00',
            end_time: '18:00'
          });
        }
        currentDate = addDays(currentDate, 1);
      }

      if (entries.length === 0) {
        toast.info('Ces dates sont déjà enregistrées');
        setDialogOpen(false);
        setDateRange({ from: undefined, to: undefined });
        return;
      }

      const { error } = await supabase
        .from('availabilities')
        .insert(entries);

      if (error) throw error;

      toast.success(entries.length > 1 
        ? `${entries.length} jours de disponibilité ajoutés`
        : 'Disponibilité ajoutée'
      );
      setDialogOpen(false);
      setDateRange({ from: undefined, to: undefined });
      loadAvailabilities();
    } catch (error: any) {
      console.error('Error adding availability:', error);
      toast.error("Erreur lors de l'ajout: " + (error.message || error.code || 'Erreur inconnue'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    try {
      const { error } = await supabase
        .from('availabilities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Disponibilité supprimée');
      loadAvailabilities();
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDeleteRange = async (date: string) => {
    try {
      const { error } = await supabase
        .from('availabilities')
        .delete()
        .eq('user_id', user?.id)
        .eq('date', date);

      if (error) throw error;

      toast.success('Disponibilité supprimée');
      loadAvailabilities();
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Generate next 14 days for quick view
  const next14Days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  const hasMyAvailabilityOn = (day: Date) => {
    return myAvailabilities.some(a => a.date === format(day, 'yyyy-MM-dd'));
  };

  const getAvailabilitiesForDate = (day: Date) => {
    return allAvailabilities.filter(a => a.date === format(day, 'yyyy-MM-dd'));
  };

  const getOthersCountForDate = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return allAvailabilities.filter(a => a.date === dateStr && a.user_id !== user?.id).length;
  };

  const openDateDetail = (day: Date) => {
    setSelectedDate(day);
    setDetailDialogOpen(true);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Disponibilités équipe
        </h3>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setDialogOpen(true)}
          className="h-8"
        >
          <Plus className="w-4 h-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Quick 14-day view */}
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
            {day}
          </div>
        ))}
        {next14Days.map((day) => {
          const hasMyAvailability = hasMyAvailabilityOn(day);
          const othersCount = getOthersCountForDate(day);
          const totalCount = getAvailabilitiesForDate(day).length;
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                if (totalCount > 0) {
                  openDateDetail(day);
                }
              }}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors relative",
                isToday && "ring-2 ring-primary",
                hasMyAvailability && "bg-success/20 text-success",
                !hasMyAvailability && othersCount > 0 && "bg-primary/10 text-primary",
                !hasMyAvailability && othersCount === 0 && "bg-secondary text-muted-foreground"
              )}
            >
              <span className="font-medium">{format(day, 'd')}</span>
              {totalCount > 0 && (
                <span className="text-[10px] flex items-center gap-0.5">
                  <Users className="w-2.5 h-2.5" />
                  {totalCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground mb-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success/20" />
          <span>Vous</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/10" />
          <span>Collègues</span>
        </div>
      </div>

      {/* My upcoming availabilities list */}
      {myAvailabilities.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">Mes disponibilités :</p>
          {myAvailabilities.slice(0, 5).map((availability) => (
            <div 
              key={availability.id}
              className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2"
            >
              <span className="text-sm text-foreground">
                {format(new Date(availability.date), 'EEEE d MMMM', { locale: fr })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteAvailability(availability.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {myAvailabilities.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              +{myAvailabilities.length - 5} autres jours
            </p>
          )}
        </div>
      )}

      {myAvailabilities.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Vous n'avez pas de disponibilité enregistrée
        </p>
      )}

      {/* Add Availability Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une disponibilité</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionnez une date ou une plage de dates
            </p>
            
            <div className="flex justify-center">
              <CalendarPicker
                mode="range"
                selected={dateRange}
                onSelect={(range) => setDateRange(range || { from: undefined, to: undefined })}
                disabled={(date) => date < startOfDay(new Date())}
                className="rounded-md border pointer-events-auto"
                locale={fr}
              />
            </div>

            {dateRange.from && (
              <div className="text-sm text-center text-foreground">
                {dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime() ? (
                  <>
                    Du <strong>{format(dateRange.from, 'd MMMM', { locale: fr })}</strong> au{' '}
                    <strong>{format(dateRange.to, 'd MMMM yyyy', { locale: fr })}</strong>
                  </>
                ) : (
                  <strong>{format(dateRange.from, 'EEEE d MMMM yyyy', { locale: fr })}</strong>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setDateRange({ from: undefined, to: undefined });
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleAddAvailability}
                disabled={!dateRange.from || saving}
                className="flex-1"
              >
                {saving ? 'Enregistrement...' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Date Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Personnes disponibles :</p>
            {selectedDate && getAvailabilitiesForDate(selectedDate).map((availability) => {
              const isMe = availability.user_id === user?.id;
              const name = profileNames[availability.user_id] || 'Chargement...';
              
              return (
                <div 
                  key={availability.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2",
                    isMe ? "bg-success/10" : "bg-secondary/50"
                  )}
                >
                  <span className="text-sm text-foreground">
                    {isMe ? 'Vous' : name}
                  </span>
                  {isMe && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        handleDeleteAvailability(availability.id);
                        setDetailDialogOpen(false);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
