-- Move sensitive contact fields out of public.profiles to eliminate org-wide exposure

-- 1) Create a dedicated contacts table
CREATE TABLE IF NOT EXISTS public.profile_contacts (
  user_id uuid PRIMARY KEY,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;

-- keep timestamps fresh
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_profile_contacts_updated_at ON public.profile_contacts;
CREATE TRIGGER update_profile_contacts_updated_at
BEFORE UPDATE ON public.profile_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Policies: self + admin (within same org)
DROP POLICY IF EXISTS "Users can view own contacts" ON public.profile_contacts;
CREATE POLICY "Users can view own contacts"
ON public.profile_contacts
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view org contacts" ON public.profile_contacts;
CREATE POLICY "Admins can view org contacts"
ON public.profile_contacts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND user_id IN (
    SELECT p.user_id
    FROM public.profiles p
    WHERE (
      p.admin_id = auth.uid()
      OR p.invite_code_id IN (
        SELECT ic.id FROM public.invite_codes ic WHERE ic.admin_id = auth.uid()
      )
      OR p.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can upsert own contacts" ON public.profile_contacts;
CREATE POLICY "Users can upsert own contacts"
ON public.profile_contacts
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own contacts" ON public.profile_contacts;
CREATE POLICY "Users can update own contacts"
ON public.profile_contacts
FOR UPDATE
USING (user_id = auth.uid());

-- 2) Backfill from profiles (if columns still exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='email'
  ) THEN
    INSERT INTO public.profile_contacts (user_id, email, phone)
    SELECT user_id, email, phone
    FROM public.profiles
    WHERE email IS NOT NULL OR phone IS NOT NULL
    ON CONFLICT (user_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      phone = EXCLUDED.phone;
  END IF;
END$$;

-- 3) Remove the definer view (linter) and drop sensitive columns from profiles
DROP VIEW IF EXISTS public.profiles_public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='email'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='phone'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN phone;
  END IF;
END$$;

-- 4) Now that profiles no longer contains contact PII, allow org members to view member directory info
-- Replace any existing SELECT policies with a safe org policy.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or organization members" ON public.profiles;

CREATE POLICY "Users can view own profile or organization members"
ON public.profiles
FOR SELECT
USING (
  (user_id = auth.uid())
  OR
  (
    (invite_code_id IS NOT NULL)
    AND invite_code_id IN (
      SELECT get_user_organization_info.user_invite_code_id
      FROM public.get_user_organization_info(auth.uid())
        AS get_user_organization_info(user_invite_code_id, user_admin_id)
    )
  )
  OR
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND (
      admin_id = auth.uid()
      OR invite_code_id IN (
        SELECT ic.id FROM public.invite_codes ic WHERE ic.admin_id = auth.uid()
      )
    )
  )
);
