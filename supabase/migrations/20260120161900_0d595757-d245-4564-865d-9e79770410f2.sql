-- Drop existing policies if they exist and recreate properly
DROP POLICY IF EXISTS "Admins can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admins can update their vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admins can delete their vehicles" ON public.vehicles;

-- Recreate insert policy
CREATE POLICY "Admins can insert vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND admin_id = auth.uid()
);

-- Recreate update policy
CREATE POLICY "Admins can update their vehicles"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (admin_id = auth.uid())
WITH CHECK (admin_id = auth.uid());

-- Recreate delete policy
CREATE POLICY "Admins can delete their vehicles"
ON public.vehicles
FOR DELETE
TO authenticated
USING (admin_id = auth.uid());