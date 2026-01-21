-- Update intervention policies to include creator role

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "Admins can create interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admins can update interventions" ON public.interventions;
DROP POLICY IF EXISTS "Admins can delete interventions" ON public.interventions;

-- Recreate policies with creator access
CREATE POLICY "Admins and creators can create interventions"
ON public.interventions
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR is_creator(auth.uid())
);

CREATE POLICY "Admins and creators can update interventions"
ON public.interventions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_creator(auth.uid())
);

CREATE POLICY "Admins and creators can delete interventions"
ON public.interventions
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_creator(auth.uid())
);