-- Create a function that will be called by the trigger to send push notifications for news
CREATE OR REPLACE FUNCTION public.notify_new_news()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only notify if the news is published
  IF NEW.published = true THEN
    -- Build the payload
    payload := jsonb_build_object(
      'title', '📰 Nouvelle actualité',
      'body', NEW.title,
      'type', 'news',
      'newsId', NEW.id,
      'senderUserId', NEW.admin_id
    );

    -- Get secrets
    SELECT value INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
    SELECT value INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
    
    -- Call the edge function via pg_net
    IF supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := payload
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger for new news (only on INSERT when published)
DROP TRIGGER IF EXISTS trigger_notify_new_news ON public.news;

CREATE TRIGGER trigger_notify_new_news
  AFTER INSERT ON public.news
  FOR EACH ROW
  WHEN (NEW.published = true)
  EXECUTE FUNCTION public.notify_new_news();

-- Also trigger when a news is updated to published
DROP TRIGGER IF EXISTS trigger_notify_published_news ON public.news;

CREATE TRIGGER trigger_notify_published_news
  AFTER UPDATE ON public.news
  FOR EACH ROW
  WHEN (OLD.published = false AND NEW.published = true)
  EXECUTE FUNCTION public.notify_new_news();