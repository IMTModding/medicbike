-- Create a function that will be called by the trigger to send push notifications
CREATE OR REPLACE FUNCTION public.notify_new_intervention()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  urgency_text TEXT;
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
  
  -- Call the edge function via pg_net (HTTP extension)
  PERFORM net.http_post(
    url := (SELECT value FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := payload
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger for new interventions
DROP TRIGGER IF EXISTS trigger_notify_new_intervention ON public.interventions;

CREATE TRIGGER trigger_notify_new_intervention
  AFTER INSERT ON public.interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_intervention();