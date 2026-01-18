import { useState, useEffect } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Plus, Trash2, X } from 'lucide-react';
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

interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

export const AvailabilityCalendar = () => {
  const { user } = useAuth();
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const loadAvailabilities = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('availabilities')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(new Date(), 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;
      setAvailabilities(data || []);
    } catch (error) {
      console.error('Error loading availabilities:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const hasAvailabilityOn = (day: Date) => {
    return availabilities.some(a => a.date === format(day, 'yyyy-MM-dd'));
  };

  const getAvailabilityForDate = (day: Date) => {
    return availabilities.find(a => a.date === format(day, 'yyyy-MM-dd'));
  };

  // Get dates with availabilities for calendar highlighting
  const availableDates = availabilities.map(a => new Date(a.date));

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Mes disponibilités
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
          const hasAvailability = hasAvailabilityOn(day);
          const isToday = isSameDay(day, new Date());
          const availability = getAvailabilityForDate(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                if (hasAvailability && availability) {
                  handleDeleteRange(format(day, 'yyyy-MM-dd'));
                }
              }}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors relative group",
                isToday && "ring-2 ring-primary",
                hasAvailability && "bg-success/20 text-success hover:bg-destructive/20 hover:text-destructive",
                !hasAvailability && "bg-secondary text-muted-foreground"
              )}
              title={hasAvailability ? "Cliquer pour supprimer" : ""}
            >
              <span className="font-medium">{format(day, 'd')}</span>
              {hasAvailability && (
                <Trash2 className="w-3 h-3 absolute opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          );
        })}
      </div>

      {/* Upcoming availabilities list */}
      {availabilities.length > 0 && (
        <div className="space-y-2 max-h-32 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">Prochaines disponibilités :</p>
          {availabilities.slice(0, 5).map((availability) => (
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
          {availabilities.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              +{availabilities.length - 5} autres jours
            </p>
          )}
        </div>
      )}

      {availabilities.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Aucune disponibilité enregistrée
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
    </div>
  );
};
