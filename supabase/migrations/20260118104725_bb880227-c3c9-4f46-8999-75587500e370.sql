-- Create a function that will be called by the trigger to send push notifications for chat messages
CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  supabase_url TEXT;
  service_key TEXT;
  sender_name TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  -- Build the payload
  payload := jsonb_build_object(
    'title', '💬 ' || COALESCE(sender_name, 'Nouveau message'),
    'body', CASE WHEN length(NEW.message) > 50 THEN substring(NEW.message, 1, 50) || '...' ELSE NEW.message END,
    'type', 'chat',
    'organizationId', NEW.organization_id,
    'excludeUserId', NEW.user_id,
    'senderUserId', NEW.user_id
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger for new chat messages
DROP TRIGGER IF EXISTS trigger_notify_new_chat_message ON public.general_messages;

CREATE TRIGGER trigger_notify_new_chat_message
  AFTER INSERT ON public.general_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_chat_message();