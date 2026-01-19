-- Fix storage policy for news bucket to prevent cross-organization access
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Admins can delete news images" ON storage.objects;

-- Create new policy that verifies ownership (admin can only delete files in their own folder)
CREATE POLICY "Admins can delete their own news images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'news' 
  AND has_role(auth.uid(), 'admin'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Also fix UPDATE policy if it exists
DROP POLICY IF EXISTS "Admins can update news images" ON storage.objects;

CREATE POLICY "Admins can update their own news images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'news' 
  AND has_role(auth.uid(), 'admin'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);