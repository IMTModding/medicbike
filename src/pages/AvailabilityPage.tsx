import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, Calendar, Plus, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Availability {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
}

const AvailabilityPage = () => {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 13) // 2 weeks
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const loadAvailabilities = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('availabilities')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;
      setAvailabilities(data || []);
    } catch (error) {
      console.error('Error loading availabilities:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAvailabilities();
    }
  }, [user]);

  const handleAddAvailability = async () => {
    if (!user) return;

    if (startTime >= endTime) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('availabilities')
        .insert({
          user_id: user.id,
          date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: startTime,
          end_time: endTime
        });

      if (error) throw error;

      toast.success('Disponibilité ajoutée');
      setDialogOpen(false);
      loadAvailabilities();
    } catch (error: any) {
      console.error('Error adding availability:', error);
      if (error.code === '23505') {
        toast.error('Cette disponibilité existe déjà');
      } else {
        toast.error("Erreur lors de l'ajout");
      }
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

  const getAvailabilitiesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilities.filter(a => a.date === dateStr);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-lg text-foreground">Disponibilités</h1>
              <p className="text-xs text-muted-foreground">Gérez vos créneaux</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une disponibilité</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="bg-secondary mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Début</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="bg-secondary mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Fin</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="bg-secondary mt-1.5"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="secondary" 
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button 
                  onClick={handleAddAvailability}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ajouter'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Calendar Grid */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Prochains jours
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
              <div key={i} className="text-center text-xs text-muted-foreground font-medium py-2">
                {day}
              </div>
            ))}
            {weekDays.map((day) => {
              const dayAvailabilities = getAvailabilitiesForDate(day);
              const hasAvailability = dayAvailabilities.length > 0;
              const isToday = isSameDay(day, new Date());
              const isPast = day < new Date() && !isToday;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    if (!isPast) {
                      setSelectedDate(day);
                      setDialogOpen(true);
                    }
                  }}
                  disabled={isPast}
                  className={cn(
                    "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors relative",
                    isPast && "opacity-40 cursor-not-allowed",
                    isToday && "ring-2 ring-primary",
                    hasAvailability && "bg-success/20 text-success",
                    !hasAvailability && !isPast && "bg-secondary hover:bg-accent"
                  )}
                >
                  <span className="font-medium">{format(day, 'd')}</span>
                  {hasAvailability && (
                    <span className="text-[10px]">{dayAvailabilities.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Availabilities List */}
        <div className="space-y-4">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Mes disponibilités
          </h3>
          
          {availabilities.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">Aucune disponibilité enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availabilities.map((availability) => (
                <div
                  key={availability.id}
                  className="bg-card rounded-xl border border-border p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {format(new Date(availability.date), 'EEEE d MMMM', { locale: fr })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {availability.start_time.slice(0, 5)} - {availability.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteAvailability(availability.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AvailabilityPage;
