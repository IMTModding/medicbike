-- Drop and recreate foreign key with ON DELETE CASCADE for intervention_responses
ALTER TABLE public.intervention_responses 
DROP CONSTRAINT IF EXISTS intervention_responses_intervention_id_fkey;

ALTER TABLE public.intervention_responses
ADD CONSTRAINT intervention_responses_intervention_id_fkey
FOREIGN KEY (intervention_id) 
REFERENCES public.interventions(id) 
ON DELETE CASCADE;