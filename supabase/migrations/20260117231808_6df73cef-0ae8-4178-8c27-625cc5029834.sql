-- Fix: Invite codes should only be visible to the admin who created them
-- Users validating a code will use a server-side function instead
DROP POLICY IF EXISTS "Authenticated users can read active invite codes" ON public.invite_codes;

-- Only admins can see their own invite codes
CREATE POLICY "Admins can view their own invite codes"
ON public.invite_codes FOR SELECT
TO authenticated
USING (admin_id = auth.uid());

-- Create a secure function for validating invite codes during signup
-- This allows code validation without exposing all codes
CREATE OR REPLACE FUNCTION public.validate_invite_code(code_to_validate TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  organization_name TEXT,
  admin_id UUID,
  code_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true AS is_valid,
    ic.organization_name,
    ic.admin_id,
    ic.id AS code_id
  FROM public.invite_codes ic
  WHERE ic.code = UPPER(code_to_validate)
    AND ic.is_active = true
  LIMIT 1;
  
  -- If no rows returned, return a single row with is_valid = false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID, NULL::UUID;
  END IF;
END;
$$;

-- Grant execute permission to authenticated and anon users (for signup flow)
GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO anon;