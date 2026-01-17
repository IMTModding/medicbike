import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertTriangle, MapPin, FileText, Loader2, CheckCircle2, Sparkles, Navigation } from 'lucide-react';
import { createIntervention, Urgency } from '@/services/interventions';
import { sendPushNotification } from '@/services/pushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CreateAlertDialogProps {
  onCreated: () => void;
}

export const CreateAlertDialog = ({ onCreated }: CreateAlertDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [title, setTitle] = useState('');
  const [numero, setNumero] = useState('');
  const [rue, setRue] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [ville, setVille] = useState('');
  const [description, setDescription] = useState('');
  const [urgency] = useState<Urgency>('high');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  const { user } = useAuth();

  const fullAddress = [numero, rue, codePostal, ville].filter(Boolean).join(' ').trim();

  const openGPSNavigation = () => {
    if (fullAddress) {
      const encodedAddress = encodeURIComponent(fullAddress);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !rue.trim() || !ville.trim() || !user) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }
    
    setLoading(true);
    
    try {
      await createIntervention({
        title: title.trim(),
        location: fullAddress,
        description: description.trim() || undefined,
        urgency,
        created_by: user.id,
      });
      
      // Send push notification to all employees
      const notifTitle = `🚨 URGENT: ${title.trim()}`;
      
      await sendPushNotification(
        notifTitle,
        `📍 ${fullAddress}`,
        urgency,
        crypto.randomUUID()
      );
      
      setSuccess(true);
      
      // Wait for success animation
      setTimeout(() => {
        toast.success('Alerte créée et notifications envoyées !');
        setOpen(false);
        resetForm();
        onCreated();
      }, 1200);
      
    } catch (error) {
      console.error('Error creating intervention:', error);
      toast.error("Erreur lors de la création de l'alerte");
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setNumero('');
    setRue('');
    setCodePostal('');
    setVille('');
    setDescription('');
    setLoading(false);
    setSuccess(false);
    setFocusedField(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  const isFormValid = title.trim() && rue.trim() && ville.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          size="lg" 
          className={cn(
            "fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-xl",
            "bg-primary hover:bg-primary/90 transition-all duration-300",
            "hover:scale-110 hover:shadow-2xl hover:shadow-primary/25",
            "active:scale-95"
          )}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(
        "bg-card border-border w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto",
        "animate-in fade-in-0 zoom-in-95 duration-300"
      )}>
        {success ? (
          <div className="flex flex-col items-center justify-center py-12 animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center animate-in zoom-in-0 duration-500">
                <CheckCircle2 className="w-10 h-10 text-success animate-in zoom-in-50 duration-300 delay-200" />
              </div>
              <Sparkles className="w-6 h-6 text-primary absolute -top-2 -right-2 animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mt-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-300">
              Alerte créée !
            </h3>
            <p className="text-muted-foreground text-center mt-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-300 delay-500">
              Les notifications sont en cours d'envoi...
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <span>Nouvelle alerte urgente</span>
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {/* Title Field */}
              <div className={cn(
                "space-y-1.5 transition-all duration-200",
                focusedField === 'title' && "scale-[1.02]"
              )}>
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Titre *
                </label>
                <Input
                  placeholder="Ex: Accident de la route"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={() => setFocusedField('title')}
                  onBlur={() => setFocusedField(null)}
                  className={cn(
                    "bg-secondary border-border transition-all duration-200",
                    focusedField === 'title' && "ring-2 ring-primary/50 border-primary"
                  )}
                />
              </div>
              
              {/* Address Fields */}
              <div className="space-y-3">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Adresse *
                </label>
                
                {/* Numéro et Rue */}
                <div className="flex gap-2">
                  <Input
                    placeholder="N°"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    onFocus={() => setFocusedField('numero')}
                    onBlur={() => setFocusedField(null)}
                    className={cn(
                      "bg-secondary border-border transition-all duration-200 w-20",
                      focusedField === 'numero' && "ring-2 ring-primary/50 border-primary"
                    )}
                  />
                  <Input
                    placeholder="Rue *"
                    value={rue}
                    onChange={(e) => setRue(e.target.value)}
                    onFocus={() => setFocusedField('rue')}
                    onBlur={() => setFocusedField(null)}
                    className={cn(
                      "bg-secondary border-border transition-all duration-200 flex-1",
                      focusedField === 'rue' && "ring-2 ring-primary/50 border-primary"
                    )}
                  />
                </div>
                
                {/* Code Postal et Ville */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Code postal"
                    value={codePostal}
                    onChange={(e) => setCodePostal(e.target.value)}
                    onFocus={() => setFocusedField('codePostal')}
                    onBlur={() => setFocusedField(null)}
                    className={cn(
                      "bg-secondary border-border transition-all duration-200 w-28",
                      focusedField === 'codePostal' && "ring-2 ring-primary/50 border-primary"
                    )}
                  />
                  <Input
                    placeholder="Ville *"
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    onFocus={() => setFocusedField('ville')}
                    onBlur={() => setFocusedField(null)}
                    className={cn(
                      "bg-secondary border-border transition-all duration-200 flex-1",
                      focusedField === 'ville' && "ring-2 ring-primary/50 border-primary"
                    )}
                  />
                </div>
                
                {/* GPS Button */}
                {fullAddress && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openGPSNavigation}
                    className="w-full text-blue-500 border-blue-500/50 hover:bg-blue-500/10"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Ouvrir le trajet GPS
                  </Button>
                )}
              </div>
              
              {/* Description Field */}
              <div className={cn(
                "space-y-1.5 transition-all duration-200",
                focusedField === 'description' && "scale-[1.02]"
              )}>
                <label className="text-sm text-muted-foreground">
                  Description
                </label>
                <Textarea
                  placeholder="Détails de l'intervention..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onFocus={() => setFocusedField('description')}
                  onBlur={() => setFocusedField(null)}
                  className={cn(
                    "bg-secondary border-border resize-none transition-all duration-200",
                    focusedField === 'description' && "ring-2 ring-primary/50 border-primary"
                  )}
                  rows={3}
                />
              </div>
              
              {/* Urgency Badge - Fixed to Urgent */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <span className="text-lg">🔴</span>
                <span className="text-sm font-medium text-red-500">Alerte Urgente</span>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 transition-all duration-200 hover:bg-secondary/80"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    "flex-1 transition-all duration-200",
                    isFormValid && !loading && "hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/25"
                  )}
                  disabled={loading || !isFormValid}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Créer l'alerte
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
