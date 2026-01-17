import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertTriangle, MapPin, FileText, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { createIntervention, Urgency } from '@/services/interventions';
import { sendPushNotification } from '@/services/pushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LocationPicker } from './LocationPicker';
import { cn } from '@/lib/utils';

interface CreateAlertDialogProps {
  onCreated: () => void;
}

const urgencyLabels: Record<Urgency, string> = {
  high: 'Urgent',
  medium: 'Moyen',
  low: 'Normal',
};

const urgencyConfig: Record<Urgency, { emoji: string; color: string; bgColor: string; ringColor: string }> = {
  high: { 
    emoji: '🔴', 
    color: 'text-red-500', 
    bgColor: 'bg-red-500/10',
    ringColor: 'ring-red-500/50'
  },
  medium: { 
    emoji: '🟠', 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-500/10',
    ringColor: 'ring-orange-500/50'
  },
  low: { 
    emoji: '🟢', 
    color: 'text-green-500', 
    bgColor: 'bg-green-500/10',
    ringColor: 'ring-green-500/50'
  },
};

export const CreateAlertDialog = ({ onCreated }: CreateAlertDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  const { user } = useAuth();

  const handleLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !location.trim() || !user) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }
    
    setLoading(true);
    
    try {
      await createIntervention({
        title: title.trim(),
        location: location.trim(),
        description: description.trim() || undefined,
        urgency,
        created_by: user.id,
        latitude,
        longitude,
      });
      
      // Send push notification to all employees
      const notifTitle = urgency === 'high' 
        ? `🚨 URGENT: ${title.trim()}`
        : `📢 ${title.trim()}`;
      
      await sendPushNotification(
        notifTitle,
        `📍 ${location.trim()}`,
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
    setLocation('');
    setDescription('');
    setUrgency('medium');
    setLatitude(null);
    setLongitude(null);
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

  const isFormValid = title.trim() && location.trim();

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
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                  urgencyConfig[urgency].bgColor
                )}>
                  <AlertTriangle className={cn("w-4 h-4", urgencyConfig[urgency].color)} />
                </div>
                <span>Nouvelle alerte</span>
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
              
              {/* Location Field */}
              <div className={cn(
                "space-y-1.5 transition-all duration-200",
                focusedField === 'location' && "scale-[1.02]"
              )}>
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Adresse *
                </label>
                <Input
                  placeholder="Ex: 15 Rue de la Paix, Paris"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onFocus={() => setFocusedField('location')}
                  onBlur={() => setFocusedField(null)}
                  className={cn(
                    "bg-secondary border-border transition-all duration-200",
                    focusedField === 'location' && "ring-2 ring-primary/50 border-primary"
                  )}
                />
              </div>
              
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                onLocationChange={handleLocationChange}
              />
              
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
              
              {/* Urgency Selection */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Niveau d'urgence
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['high', 'medium', 'low'] as Urgency[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setUrgency(level)}
                      className={cn(
                        "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all duration-200",
                        urgency === level 
                          ? cn("border-current", urgencyConfig[level].color, urgencyConfig[level].bgColor, "scale-105")
                          : "border-border bg-secondary hover:bg-secondary/80"
                      )}
                    >
                      <span className="text-lg">{urgencyConfig[level].emoji}</span>
                      <span className={cn(
                        "text-xs font-medium",
                        urgency === level ? urgencyConfig[level].color : "text-muted-foreground"
                      )}>
                        {urgencyLabels[level]}
                      </span>
                    </button>
                  ))}
                </div>
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
