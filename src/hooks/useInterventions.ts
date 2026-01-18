import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchInterventions,
  fetchHistoryInterventions,
  respondToIntervention,
  completeIntervention,
  createIntervention,
  Intervention,
  InterventionWithResponses,
  Urgency,
} from '@/services/interventions';

// Query keys
export const interventionKeys = {
  all: ['interventions'] as const,
  active: (userId: string) => [...interventionKeys.all, 'active', userId] as const,
  history: (startDate?: string, endDate?: string) => [...interventionKeys.all, 'history', startDate, endDate] as const,
};

export const newsKeys = {
  all: ['news'] as const,
  latest: () => [...newsKeys.all, 'latest'] as const,
  list: () => [...newsKeys.all, 'list'] as const,
};

// Fetch active interventions with caching
export const useActiveInterventions = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: interventionKeys.active(userId || ''),
    queryFn: () => fetchInterventions(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    const interventionsChannel = supabase
      .channel('interventions-cache')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'interventions' },
        () => {
          queryClient.invalidateQueries({ queryKey: interventionKeys.active(userId) });
        }
      )
      .subscribe();

    const responsesChannel = supabase
      .channel('responses-cache')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intervention_responses' },
        () => {
          queryClient.invalidateQueries({ queryKey: interventionKeys.active(userId) });
        }
      )
      .subscribe();

    return () => {
      interventionsChannel.unsubscribe();
      responsesChannel.unsubscribe();
    };
  }, [userId, queryClient]);

  return query;
};

// Fetch history interventions with caching
export const useHistoryInterventions = (startDate?: string, endDate?: string) => {
  return useQuery({
    queryKey: interventionKeys.history(startDate, endDate),
    queryFn: () => fetchHistoryInterventions(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    ),
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

// Mutation for responding to intervention
export const useRespondToIntervention = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ interventionId, userId, status }: { 
      interventionId: string; 
      userId: string; 
      status: 'available' | 'unavailable';
    }) => respondToIntervention(interventionId, userId, status),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: interventionKeys.active(userId) });
    },
  });
};

// Mutation for completing intervention
export const useCompleteIntervention = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => completeIntervention(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interventionKeys.all });
    },
  });
};

// Mutation for creating intervention
export const useCreateIntervention = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      location: string;
      description?: string;
      urgency: Urgency;
      created_by: string;
      latitude?: number | null;
      longitude?: number | null;
    }) => createIntervention(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interventionKeys.all });
    },
  });
};

// Fetch latest news with caching
export const useLatestNews = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: newsKeys.latest(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('id, title, image_url, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('news-cache')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'news' },
        () => {
          queryClient.invalidateQueries({ queryKey: newsKeys.all });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  return query;
};
