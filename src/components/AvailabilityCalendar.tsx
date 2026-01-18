import { useState, useEffect } from 'react';
import { format, addDays, isSameDay, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isBefore, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Plus, Trash2, X, Users, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'list'>('week');

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
        .gte('date', format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'))
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

  // Generate days for current month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Add padding days for start of month
  const startDayOfWeek = getDay(monthStart);
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Monday = 0

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

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const renderDayCell = (day: Date, isMonthView: boolean = false) => {
    const hasMyAvailability = hasMyAvailabilityOn(day);
    const othersCount = getOthersCountForDate(day);
    const totalCount = getAvailabilitiesForDate(day).length;
    const isPast = isBefore(day, startOfDay(new Date()));
    const isTodayDate = isToday(day);

    return (
      <button
        key={day.toISOString()}
        onClick={() => {
          if (totalCount > 0) {
            openDateDetail(day);
          }
        }}
        disabled={isPast && totalCount === 0}
        className={cn(
          "rounded-lg flex flex-col items-center justify-center text-xs transition-all relative",
          isMonthView ? "aspect-square p-1" : "aspect-square",
          isTodayDate && "ring-2 ring-primary ring-offset-1 ring-offset-background",
          hasMyAvailability && othersCount > 0 && "bg-gradient-to-br from-success/30 to-primary/30",
          hasMyAvailability && othersCount === 0 && "bg-success/20 text-success",
          !hasMyAvailability && othersCount > 0 && "bg-primary/15 text-primary",
          !hasMyAvailability && othersCount === 0 && "bg-secondary/50 text-muted-foreground",
          isPast && "opacity-50",
          totalCount > 0 && "cursor-pointer hover:scale-105 hover:shadow-md"
        )}
      >
        <span className={cn("font-semibold", isMonthView ? "text-[11px]" : "text-xs")}>
          {format(day, 'd')}
        </span>
        {totalCount > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <Users className={cn(isMonthView ? "w-2 h-2" : "w-2.5 h-2.5")} />
            <span className={cn(isMonthView ? "text-[9px]" : "text-[10px]")}>{totalCount}</span>
          </div>
        )}
      </button>
    );
  };

  // Group availabilities by user for the upcoming list
  const upcomingByUser = () => {
    const grouped: Record<string, Availability[]> = {};
    allAvailabilities
      .filter(a => !isBefore(parseISO(a.date), startOfDay(new Date())))
      .slice(0, 50)
      .forEach(a => {
        if (!grouped[a.user_id]) {
          grouped[a.user_id] = [];
        }
        grouped[a.user_id].push(a);
      });
    return grouped;
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

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'week' | 'month' | 'list')} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="week">2 semaines</TabsTrigger>
          <TabsTrigger value="month">Mois</TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-0">
          {/* Quick 14-day view */}
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
              <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
                {day}
              </div>
            ))}
            {next14Days.map((day) => renderDayCell(day))}
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-success/20 border border-success/30" />
              <span>Vous seul</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary/15 border border-primary/30" />
              <span>Collègues</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-success/30 to-primary/30 border border-primary/30" />
              <span>Vous + collègues</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="month" className="mt-0">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-foreground capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
              <div key={i} className="text-center text-[10px] text-muted-foreground font-medium py-1">
                {day}
              </div>
            ))}
            {/* Padding for start of month */}
            {Array.from({ length: paddingDays }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square" />
            ))}
            {monthDays.map((day) => renderDayCell(day, true))}
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-success/20 border border-success/30" />
              <span>Vous seul</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-primary/15 border border-primary/30" />
              <span>Collègues</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-gradient-to-br from-success/30 to-primary/30 border border-primary/30" />
              <span>Vous + collègues</span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          {/* Upcoming availabilities by person */}
          <div className="space-y-3 max-h-80 overflow-y-auto">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 sticky top-0 bg-card pb-2">
              <Users className="w-3 h-3" />
              Prochaines disponibilités par personne :
            </p>
            
            {Object.entries(upcomingByUser()).map(([userId, availabilities]) => {
              const isMe = userId === user?.id;
              const name = isMe ? 'Vous' : (profileNames[userId] || 'Chargement...');
              const sortedAvails = availabilities.sort((a, b) => a.date.localeCompare(b.date));
              
              return (
                <div 
                  key={userId}
                  className={cn(
                    "rounded-lg p-3 border",
                    isMe ? "bg-success/5 border-success/20" : "bg-secondary/30 border-border"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      isMe ? "bg-success/20 text-success" : "bg-primary/20 text-primary"
                    )}>
                      <User className="w-3 h-3" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({sortedAvails.length} jour{sortedAvails.length > 1 ? 's' : ''})
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5">
                    {sortedAvails.slice(0, 10).map((avail) => (
                      <div 
                        key={avail.id}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-full flex items-center gap-1",
                          isMe ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                        )}
                      >
                        <span>{format(parseISO(avail.date), 'd MMM', { locale: fr })}</span>
                        {isMe && (
                          <button 
                            onClick={() => handleDeleteAvailability(avail.id)}
                            className="hover:text-destructive ml-0.5"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {sortedAvails.length > 10 && (
                      <span className="text-[10px] px-2 py-1 text-muted-foreground">
                        +{sortedAvails.length - 10}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {Object.keys(upcomingByUser()).length === 0 && !loading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucune disponibilité enregistrée
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

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
              <div className="text-sm text-center text-foreground bg-primary/5 rounded-lg p-3">
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
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {selectedDate && format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>
                {selectedDate && getAvailabilitiesForDate(selectedDate).length} personne(s) disponible(s)
              </span>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedDate && getAvailabilitiesForDate(selectedDate).map((availability) => {
                const isMe = availability.user_id === user?.id;
                const name = profileNames[availability.user_id] || 'Chargement...';
                
                return (
                  <div 
                    key={availability.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-4 py-3 border",
                      isMe ? "bg-success/5 border-success/20" : "bg-secondary/30 border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isMe ? "bg-success/20 text-success" : "bg-primary/20 text-primary"
                      )}>
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-foreground block">
                          {isMe ? 'Vous' : name}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(availability.start_time)} - {formatTime(availability.end_time)}
                        </span>
                      </div>
                    </div>
                    {isMe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
