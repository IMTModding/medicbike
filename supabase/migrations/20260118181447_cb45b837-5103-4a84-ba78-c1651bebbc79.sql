-- Create vehicles table for motorcycles
CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  organization_id UUID REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create intervention_assignments table
CREATE TABLE public.intervention_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_assignments ENABLE ROW LEVEL SECURITY;

-- Vehicles RLS policies
CREATE POLICY "Admins can create vehicles"
ON public.vehicles
FOR INSERT
WITH CHECK (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update their vehicles"
ON public.vehicles
FOR UPDATE
USING (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete their vehicles"
ON public.vehicles
FOR DELETE
USING (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Organization members can view vehicles"
ON public.vehicles
FOR SELECT
USING (
  admin_id = auth.uid()
  OR organization_id IN (
    SELECT get_user_organization_info.user_invite_code_id
    FROM get_user_organization_info(auth.uid())
  )
  OR admin_id IN (
    SELECT get_user_organization_info.user_admin_id
    FROM get_user_organization_info(auth.uid())
  )
);

-- Intervention assignments RLS policies
CREATE POLICY "Admins can create assignments"
ON public.intervention_assignments
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update assignments"
ON public.intervention_assignments
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete assignments"
ON public.intervention_assignments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Organization members can view assignments"
ON public.intervention_assignments
FOR SELECT
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR intervention_id IN (
    SELECT i.id FROM interventions i
    WHERE i.created_by IN (
      SELECT p.user_id FROM profiles p
      WHERE p.invite_code_id IN (
        SELECT get_user_organization_info.user_invite_code_id
        FROM get_user_organization_info(auth.uid())
      )
      OR p.user_id IN (
        SELECT get_user_organization_info.user_admin_id
        FROM get_user_organization_info(auth.uid())
      )
    )
  )
);

-- Enable realtime for assignments
ALTER PUBLICATION supabase_realtime ADD TABLE public.intervention_assignments;