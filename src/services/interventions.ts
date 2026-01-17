import { supabase } from '@/integrations/supabase/client';

export type Urgency = 'high' | 'medium' | 'low';
export type ResponseStatus = 'pending' | 'available' | 'unavailable';

export interface Intervention {
  id: string;
  title: string;
  location: string;
  description: string | null;
  urgency: Urgency;
  created_at: string;
  created_by: string | null;
  userStatus?: ResponseStatus;
}

export interface InterventionResponse {
  id: string;
  intervention_id: string;
  user_id: string;
  status: ResponseStatus;
  responded_at: string;
}

export const fetchInterventions = async (userId: string): Promise<Intervention[]> => {
  // Fetch interventions
  const { data: interventions, error } = await supabase
    .from('interventions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch user's responses
  const { data: responses } = await supabase
    .from('intervention_responses')
    .select('*')
    .eq('user_id', userId);

  // Merge responses with interventions
  return (interventions || []).map(intervention => {
    const userResponse = responses?.find(r => r.intervention_id === intervention.id);
    return {
      ...intervention,
      userStatus: userResponse?.status as ResponseStatus || 'pending',
    };
  });
};

export const respondToIntervention = async (
  interventionId: string,
  userId: string,
  status: 'available' | 'unavailable'
): Promise<void> => {
  const { error } = await supabase
    .from('intervention_responses')
    .upsert({
      intervention_id: interventionId,
      user_id: userId,
      status,
      responded_at: new Date().toISOString(),
    }, {
      onConflict: 'intervention_id,user_id',
    });

  if (error) throw error;
};

export const createIntervention = async (data: {
  title: string;
  location: string;
  description?: string;
  urgency: Urgency;
  created_by: string;
}): Promise<void> => {
  const { error } = await supabase
    .from('interventions')
    .insert(data);

  if (error) throw error;
};

export const deleteIntervention = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('interventions')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const subscribeToInterventions = (
  callback: (payload: any) => void
) => {
  return supabase
    .channel('interventions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'interventions',
      },
      callback
    )
    .subscribe();
};
