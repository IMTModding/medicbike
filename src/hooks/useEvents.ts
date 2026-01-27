import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  admin_id: string;
  organization_id: string | null;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface EventAvailability {
  id: string;
  event_id: string;
  user_id: string;
  status: 'available' | 'unavailable' | 'maybe';
  notes: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CreateEventData {
  title: string;
  description?: string;
  event_date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  organization_id?: string;
}

export function useEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (fetchError) throw fetchError;
      setEvents((data as Event[]) || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createEvent = async (eventData: CreateEventData) => {
    if (!user) return null;

    // Get user's organization info
    const { data: profileData } = await supabase
      .from('profiles')
      .select('invite_code_id')
      .eq('user_id', user.id)
      .maybeSingle();

    try {
      const { data, error: createError } = await supabase
        .from('events')
        .insert({
          ...eventData,
          admin_id: user.id,
          organization_id: eventData.organization_id || profileData?.invite_code_id,
        })
        .select()
        .single();

      if (createError) throw createError;
      
      toast.success('Événement créé avec succès');
      await fetchEvents();
      return data as Event;
    } catch (err) {
      console.error('Error creating event:', err);
      toast.error('Erreur lors de la création de l\'événement');
      return null;
    }
  };

  const updateEvent = async (eventId: string, updates: Partial<CreateEventData> & { status?: Event['status'] }) => {
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update(updates)
        .eq('id', eventId);

      if (updateError) throw updateError;
      
      toast.success('Événement mis à jour');
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Error updating event:', err);
      toast.error('Erreur lors de la mise à jour');
      return false;
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (deleteError) throw deleteError;
      
      toast.success('Événement supprimé');
      await fetchEvents();
      return true;
    } catch (err) {
      console.error('Error deleting event:', err);
      toast.error('Erreur lors de la suppression');
      return false;
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchEvents]);

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    refetch: fetchEvents,
  };
}

export function useEventAvailabilities(eventId: string | null) {
  const { user } = useAuth();
  const [availabilities, setAvailabilities] = useState<EventAvailability[]>([]);
  const [myAvailability, setMyAvailability] = useState<EventAvailability | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAvailabilities = useCallback(async () => {
    if (!eventId || !user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('event_availabilities')
        .select('*')
        .eq('event_id', eventId);

      if (error) throw error;

      const availabilityData = (data as EventAvailability[]) || [];
      setAvailabilities(availabilityData);
      
      // Find my availability
      const mine = availabilityData.find(a => a.user_id === user.id);
      setMyAvailability(mine || null);
    } catch (err) {
      console.error('Error fetching availabilities:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId, user]);

  const setAvailability = async (status: EventAvailability['status'], notes?: string) => {
    if (!eventId || !user) return false;

    try {
      const { error } = await supabase
        .from('event_availabilities')
        .upsert({
          event_id: eventId,
          user_id: user.id,
          status,
          notes: notes || null,
        }, {
          onConflict: 'event_id,user_id',
        });

      if (error) throw error;
      
      toast.success('Disponibilité mise à jour');
      await fetchAvailabilities();
      return true;
    } catch (err) {
      console.error('Error setting availability:', err);
      toast.error('Erreur lors de la mise à jour');
      return false;
    }
  };

  const removeAvailability = async () => {
    if (!eventId || !user) return false;

    try {
      const { error } = await supabase
        .from('event_availabilities')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success('Disponibilité retirée');
      await fetchAvailabilities();
      return true;
    } catch (err) {
      console.error('Error removing availability:', err);
      toast.error('Erreur');
      return false;
    }
  };

  useEffect(() => {
    fetchAvailabilities();
  }, [fetchAvailabilities]);

  // Realtime subscription
  useEffect(() => {
    if (!eventId || !user) return;

    const channel = supabase
      .channel(`event-availabilities-${eventId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'event_availabilities',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchAvailabilities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, user, fetchAvailabilities]);

  return {
    availabilities,
    myAvailability,
    loading,
    setAvailability,
    removeAvailability,
    refetch: fetchAvailabilities,
  };
}
