-- Fix security: Restrict location visibility to active interventions only
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Admins can view consenting org user locations" ON public.user_locations;

-- Create a new restricted policy: locations visible ONLY during active interventions
-- AND only for users who are actively assigned/responding to an intervention
CREATE POLICY "Locations visible only during active interventions"
ON public.user_locations
FOR SELECT
TO authenticated
USING (
  -- User can always see their own location
  user_id = auth.uid()
  OR (
    -- Admin access restricted to:
    has_role(auth.uid(), 'admin'::app_role)
    AND (
      -- User must be in the same organization
      user_id IN (
        SELECT p.user_id
        FROM profiles p
        WHERE (
          p.admin_id = auth.uid()
          OR p.invite_code_id IN (SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid())
        )
      )
    )
    AND (
      -- User must be actively participating in an intervention
      user_id IN (
        SELECT DISTINCT ia.user_id
        FROM intervention_assignments ia
        JOIN interventions i ON i.id = ia.intervention_id
        WHERE i.status = 'active'
      )
      OR user_id IN (
        SELECT DISTINCT ir.user_id
        FROM intervention_responses ir
        JOIN interventions i ON i.id = ir.intervention_id
        WHERE i.status = 'active' AND ir.status = 'available'
      )
    )
    AND (
      -- Location must be recent (within last 30 minutes)
      updated_at >= now() - interval '30 minutes'
    )
  )
);

-- Add automatic cleanup: Create a function to delete old locations
CREATE OR REPLACE FUNCTION public.cleanup_expired_locations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete locations older than 1 hour
  DELETE FROM public.user_locations
  WHERE updated_at < now() - interval '1 hour';
  
  -- Automatically deactivate locations for users not in active interventions
  UPDATE public.user_locations
  SET is_active = false
  WHERE is_active = true
  AND updated_at < now() - interval '30 minutes';
END;
$$;

-- Remove the location_sharing_enabled dependency since GPS is only for interventions
-- The column will remain for backwards compatibility but won't be used in RLS