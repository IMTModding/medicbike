-- Fix the function with proper search_path for security
CREATE OR REPLACE FUNCTION public.notify_new_intervention()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  urgency_text TEXT;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Build urgency text
  CASE NEW.urgency
    WHEN 'high' THEN urgency_text := '🚨 URGENTE';
    WHEN 'medium' THEN urgency_text := '⚠️ Moyenne';
    ELSE urgency_text := 'ℹ️ Basse';
  END CASE;
  
  -- Build the payload
  payload := jsonb_build_object(
    'title', urgency_text || ' - ' || NEW.title,
    'body', NEW.location,
    'urgency', NEW.urgency,
    'interventionId', NEW.id,
    'senderUserId', NEW.created_by
  );

  -- Get secrets
  SELECT value INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
  SELECT value INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
  
  -- Call the edge function via pg_net (HTTP extension)
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;