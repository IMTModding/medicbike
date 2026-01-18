-- Ensure profiles has an email column (used for listing/copy)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

-- Helpful index for lookup/search
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Recreate get_organization_profiles to include members via invite_code OR admin_id, and cast email consistently
DROP FUNCTION IF EXISTS public.get_organization_profiles(uuid);

CREATE OR REPLACE FUNCTION public.get_organization_profiles(p_user_id uuid)
RETURNS TABLE(
  admin_id uuid,
  avatar_url text,
  created_at timestamptz,
  email text,
  full_name text,
  id uuid,
  invite_code_id uuid,
  onboarding_completed boolean,
  phone text,
  user_id uuid,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.admin_id,
    p.avatar_url,
    p.created_at,
    COALESCE(p.email, (SELECT au.email::text FROM auth.users au WHERE au.id = p.user_id)) as email,
    p.full_name,
    p.id,
    p.invite_code_id,
    p.onboarding_completed,
    p.phone,
    p.user_id,
    COALESCE((SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.user_id LIMIT 1), 'employee') as role
  FROM public.profiles p
  WHERE
    -- employees attached by invite code
    p.invite_code_id IN (SELECT ic.id FROM public.invite_codes ic WHERE ic.admin_id = p_user_id)
    OR
    -- employees attached directly to admin
    p.admin_id = p_user_id
    OR
    -- include self
    p.user_id = p_user_id;
END;
$$;