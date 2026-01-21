-- Add completion notes field for post-intervention debriefs
ALTER TABLE public.interventions 
ADD COLUMN IF NOT EXISTS completion_notes TEXT DEFAULT NULL;

-- Add a comment to explain the field
COMMENT ON COLUMN public.interventions.completion_notes IS 'Notes or debrief added after intervention completion by admin/creator';