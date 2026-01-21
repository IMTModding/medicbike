import { supabase } from '@/integrations/supabase/client';

export type Urgency = 'high' | 'medium' | 'low';
export type ResponseStatus = 'pending' | 'available' | 'unavailable';
export type InterventionStatus = 'active' | 'completed';

export interface Intervention {
  id: string;
  title: string;
  location: string;
  description: string | null;
  urgency: Urgency;
  created_at: string;
  created_by: string | null;
  status: InterventionStatus;
  completed_at: string | null;
  completion_notes: string | null;
  latitude?: number | null;
  longitude?: number | null;
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

export const fetchInterventions = async (userId: string, includeCompleted = false): Promise<Intervention[]> => {
  // Fetch interventions
  let query = supabase
    .from('interventions')
    .select('*')
    .order('created_at', { ascending: false });

  if (!includeCompleted) {
    query = query.eq('status', 'active');
  }

  const { data: interventions, error } = await query;

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

export const fetchInterventionsWithResponses = async (status?: InterventionStatus): Promise<InterventionWithResponses[]> => {
  // Fetch interventions
  let query = supabase
    .from('interventions')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data: interventions, error: intError } = await query;

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

export const fetchHistoryInterventions = async (
  startDate?: Date,
  endDate?: Date
): Promise<InterventionWithResponses[]> => {
  let query = supabase
    .from('interventions')
    .select('*')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (startDate) {
    query = query.gte('completed_at', startDate.toISOString());
  }
  if (endDate) {
    // Add one day to include the end date fully
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.lte('completed_at', endOfDay.toISOString());
  }

  const { data: interventions, error: intError } = await query;

  if (intError) throw intError;

  // Fetch all responses
  const interventionIds = (interventions || []).map(i => i.id);
  
  if (interventionIds.length === 0) {
    return [];
  }

  const { data: responses } = await supabase
    .from('intervention_responses')
    .select('*')
    .in('intervention_id', interventionIds);

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name');

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
  latitude?: number | null;
  longitude?: number | null;
}): Promise<void> => {
  const { error } = await supabase
    .from('interventions')
    .insert({
      ...data,
      status: 'active',
    });

  if (error) throw error;
};

export const completeIntervention = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('interventions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id);

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
