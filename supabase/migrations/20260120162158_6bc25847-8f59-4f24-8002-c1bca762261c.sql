-- Mask existing IP addresses (keep only first two octets)
UPDATE public.login_history
SET ip_address = 
  CASE 
    WHEN ip_address IS NOT NULL AND ip_address ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$' 
    THEN regexp_replace(ip_address, '^(\d{1,3}\.\d{1,3})\..*$', '\1.xxx.xxx')
    ELSE ip_address
  END
WHERE ip_address IS NOT NULL;

-- Create a function to mask IP addresses on insert
CREATE OR REPLACE FUNCTION public.mask_ip_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mask IPv4 addresses: keep first two octets, replace rest with xxx
  IF NEW.ip_address IS NOT NULL AND NEW.ip_address ~ '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$' THEN
    NEW.ip_address := regexp_replace(NEW.ip_address, '^(\d{1,3}\.\d{1,3})\..*$', '\1.xxx.xxx');
  ELSIF NEW.ip_address IS NOT NULL THEN
    -- For IPv6 or other formats, just mask completely
    NEW.ip_address := 'masked';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to mask IP addresses on insert
CREATE TRIGGER mask_login_history_ip
BEFORE INSERT ON public.login_history
FOR EACH ROW
EXECUTE FUNCTION public.mask_ip_address();