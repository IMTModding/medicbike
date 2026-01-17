-- Add status to interventions (active or completed)
CREATE TYPE public.intervention_status AS ENUM ('active', 'completed');

ALTER TABLE public.interventions 
ADD COLUMN status intervention_status NOT NULL DEFAULT 'active';

ALTER TABLE public.interventions 
ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;