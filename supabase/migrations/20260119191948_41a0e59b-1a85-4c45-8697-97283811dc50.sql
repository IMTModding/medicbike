-- Add location_sharing_enabled column to profiles for consent mechanism
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location_sharing_enabled boolean NOT NULL DEFAULT false;

-- Update user_locations RLS policy to only allow tracking users who have consented
DROP POLICY IF EXISTS "Admins can view org user locations" ON public.user_locations;

CREATE POLICY "Admins can view consenting org user locations"
ON public.user_locations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND user_id IN (
    SELECT p.user_id 
    FROM profiles p
    WHERE p.location_sharing_enabled = true
    AND (
      p.admin_id = auth.uid() 
      OR p.invite_code_id IN (
        SELECT ic.id FROM invite_codes ic WHERE ic.admin_id = auth.uid()
      )
      OR p.user_id = auth.uid()
    )
  )
);

-- Users can still always view their own location
DROP POLICY IF EXISTS "Users can view their own location" ON public.user_locations;

CREATE POLICY "Users can view own location"
ON public.user_locations
FOR SELECT
TO authenticated
USING (user_id = auth.uid());