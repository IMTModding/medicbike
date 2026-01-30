-- =============================================
-- FIX 1: Renforcer les policies sur profile_contacts
-- S'assurer que seuls le propriétaire, leurs admins, et les creators peuvent voir les contacts
-- =============================================

-- Supprimer l'ancienne policy qui pourrait être trop permissive
DROP POLICY IF EXISTS "Admins and creators can view organization contacts" ON public.profile_contacts;

-- Recréer avec une validation plus stricte de l'organisation
CREATE POLICY "Admins and creators can view organization contacts"
ON public.profile_contacts
FOR SELECT
TO authenticated
USING (
  -- Creators peuvent voir tous les contacts
  is_creator(auth.uid())
  OR
  -- Admins ne peuvent voir que les contacts de leur propre organisation
  (
    has_role(auth.uid(), 'admin'::app_role) 
    AND user_id IN (
      SELECT p.user_id
      FROM profiles p
      WHERE 
        -- Employés directement gérés par cet admin
        p.admin_id = auth.uid()
        OR 
        -- Employés dans l'organisation de cet admin (même invite_code_id)
        p.invite_code_id IN (
          SELECT ic.id 
          FROM invite_codes ic 
          WHERE ic.admin_id = auth.uid()
        )
        OR
        -- L'admin lui-même
        p.user_id = auth.uid()
    )
  )
);

-- =============================================
-- FIX 2: Renforcer les policies sur events pour validation explicite de l'organisation
-- =============================================

-- Supprimer l'ancienne policy SELECT
DROP POLICY IF EXISTS "Organization members can view events" ON public.events;

-- Recréer avec une validation plus stricte et explicite
CREATE POLICY "Organization members can view events"
ON public.events
FOR SELECT
TO authenticated
USING (
  -- Creators peuvent tout voir
  is_creator(auth.uid())
  OR
  -- L'admin qui a créé l'événement
  admin_id = auth.uid()
  OR
  -- Membres de la même organisation (via invite_code_id du profil)
  (
    organization_id IS NOT NULL 
    AND organization_id IN (
      SELECT p.invite_code_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.invite_code_id IS NOT NULL
    )
  )
  OR
  -- Employés dont l'admin_id correspond à l'admin de l'événement
  (
    admin_id IS NOT NULL
    AND admin_id IN (
      SELECT p.admin_id 
      FROM profiles p 
      WHERE p.user_id = auth.uid()
      AND p.admin_id IS NOT NULL
    )
  )
);