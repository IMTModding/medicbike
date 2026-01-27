-- Remove the obsolete location_sharing_enabled column from profiles table
-- This column is no longer used since GPS tracking is now restricted to active interventions only

ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS location_sharing_enabled;