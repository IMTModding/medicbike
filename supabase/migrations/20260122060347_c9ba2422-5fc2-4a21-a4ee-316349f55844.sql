-- Créer le trigger pour les nouvelles interventions
CREATE TRIGGER notify_new_intervention_trigger
AFTER INSERT ON public.interventions
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_intervention();