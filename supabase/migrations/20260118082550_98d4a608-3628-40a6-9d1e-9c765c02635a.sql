-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create news table
CREATE TABLE public.news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  admin_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Admins can manage their own news
CREATE POLICY "Admins can create news"
ON public.news
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update their news"
ON public.news
FOR UPDATE
USING (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete their news"
ON public.news
FOR DELETE
USING (admin_id = auth.uid() AND has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users in organization can view published news
CREATE POLICY "Users can view published news from their organization"
ON public.news
FOR SELECT
USING (
  published = true AND (
    admin_id = auth.uid() OR
    admin_id IN (
      SELECT get_user_organization_info.user_admin_id
      FROM get_user_organization_info(auth.uid())
    ) OR
    admin_id IN (
      SELECT p.admin_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- Create storage bucket for news images
INSERT INTO storage.buckets (id, name, public) VALUES ('news', 'news', true);

-- Storage policies for news bucket
CREATE POLICY "Anyone can view news images"
ON storage.objects FOR SELECT
USING (bucket_id = 'news');

CREATE POLICY "Admins can upload news images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'news' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update news images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'news' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete news images"
ON storage.objects FOR DELETE
USING (bucket_id = 'news' AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_news_updated_at
BEFORE UPDATE ON public.news
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.news;