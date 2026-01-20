-- Renforcer la protection RLS de profile_contacts avec des policies RESTRICTIVE explicites par opération

-- Supprimer l'ancienne policy ALL qui n'est pas assez granulaire
DROP POLICY IF EXISTS "Deny anon access to profile_contacts" ON public.profile_contacts;

-- Créer des policies RESTRICTIVE explicites pour chaque opération sur le rôle anon
CREATE POLICY "Deny anon SELECT on profile_contacts"
ON public.profile_contacts
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anon INSERT on profile_contacts"
ON public.profile_contacts
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Deny anon UPDATE on profile_contacts"
ON public.profile_contacts
AS RESTRICTIVE
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny anon DELETE on profile_contacts"
ON public.profile_contacts
AS RESTRICTIVE
FOR DELETE
TO anon
USING (false);