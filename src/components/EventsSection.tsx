import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Loader2 } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useAuth } from '@/contexts/AuthContext';
import { EventCard } from './EventCard';
import { CreateEventDialog } from './CreateEventDialog';
import { supabase } from '@/integrations/supabase/client';
import { isAfter, isBefore, parseISO, isToday } from 'date-fns';

export function EventsSection() {
  const { events, loading } = useEvents();
  const { isAdmin, isCreator } = useAuth();
  const [profiles, setProfiles] = useState<Map<string, { full_name: string | null; avatar_url: string | null }>>(new Map());

  // Fetch profiles for all users who have availabilities
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url');

      if (data) {
        const profileMap = new Map(
          data.map(p => [p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }])
        );
        setProfiles(profileMap);
      }
    };

    fetchProfiles();
  }, []);

  const upcomingEvents = events.filter(e => {
    const eventDate = parseISO(e.event_date);
    return (isAfter(eventDate, new Date()) || isToday(eventDate)) && 
           e.status !== 'completed' && 
           e.status !== 'cancelled';
  });

  const pastEvents = events.filter(e => {
    const eventDate = parseISO(e.event_date);
    return isBefore(eventDate, new Date()) && !isToday(eventDate);
  });

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-2xl">
          <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
          <span>Événements</span>
        </CardTitle>
        {(isAdmin || isCreator) && <CreateEventDialog />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucun événement pour le moment</p>
            {(isAdmin || isCreator) && (
              <p className="text-sm mt-1">Créez votre premier événement !</p>
            )}
          </div>
        ) : (
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="upcoming">
                À venir ({upcomingEvents.length})
              </TabsTrigger>
              <TabsTrigger value="past">
                Passés ({pastEvents.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="upcoming" className="space-y-4 mt-0">
              {upcomingEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Aucun événement à venir
                </p>
              ) : (
                upcomingEvents.map(event => (
                  <EventCard key={event.id} event={event} profiles={profiles} />
                ))
              )}
            </TabsContent>
            
            <TabsContent value="past" className="space-y-4 mt-0">
              {pastEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Aucun événement passé
                </p>
              ) : (
                pastEvents.map(event => (
                  <EventCard key={event.id} event={event} profiles={profiles} />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
