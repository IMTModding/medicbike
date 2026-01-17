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
  profile?: {
    full_name: string | null;
  };
}

export interface InterventionWithResponses extends Intervention {
  responses: InterventionResponse[];
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

export const fetchInterventionsWithResponses = async (): Promise<InterventionWithResponses[]> => {
  // Fetch interventions
  const { data: interventions, error: intError } = await supabase
    .from('interventions')
    .select('*')
    .order('created_at', { ascending: false });

  if (intError) throw intError;

  // Fetch all responses with profiles
  const { data: responses, error: respError } = await supabase
    .from('intervention_responses')
    .select('*');

  if (respError) throw respError;

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name');

  // Map responses with profiles and group by intervention
  return (interventions || []).map(intervention => {
    const interventionResponses = (responses || [])
      .filter(r => r.intervention_id === intervention.id)
      .map(r => ({
        ...r,
        profile: profiles?.find(p => p.user_id === r.user_id),
      }));

    return {
      ...intervention,
      responses: interventionResponses,
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

export const subscribeToResponses = (
  callback: (payload: any) => void
) => {
  return supabase
    .channel('responses-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'intervention_responses',
      },
      callback
    )
    .subscribe();
};
