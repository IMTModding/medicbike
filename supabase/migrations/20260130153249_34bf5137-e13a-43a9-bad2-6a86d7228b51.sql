-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Admins can create assignments" ON public.intervention_assignments;

-- Create new INSERT policy that includes creators
CREATE POLICY "Admins and creators can create assignments"
ON public.intervention_assignments
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_creator(auth.uid())
);

-- Also update DELETE policy to include creators
DROP POLICY IF EXISTS "Admins can delete assignments" ON public.intervention_assignments;

CREATE POLICY "Admins and creators can delete assignments"
ON public.intervention_assignments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_creator(auth.uid())
);

-- Also update UPDATE policy to include creators
DROP POLICY IF EXISTS "Admins can update assignments" ON public.intervention_assignments;

CREATE POLICY "Admins and creators can update assignments"
ON public.intervention_assignments
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_creator(auth.uid())
);