import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertTriangle } from 'lucide-react';
import { createIntervention, Urgency } from '@/services/interventions';
import { sendPushNotification } from '@/services/pushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { LocationPicker } from './LocationPicker';

interface CreateAlertDialogProps {
  onCreated: () => void;
}

const urgencyLabels: Record<Urgency, string> = {
  high: 'Urgent',
  medium: 'Moyen',
  low: 'Normal',
};

export const CreateAlertDialog = ({ onCreated }: CreateAlertDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  
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
      
      toast.success('Alerte créée et notifications envoyées !');
      setOpen(false);
      resetForm();
      onCreated();
    } catch (error) {
      console.error('Error creating intervention:', error);
      toast.error("Erreur lors de la création de l'alerte");
    } finally {
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
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-xl">
          <Plus className="w-6 h-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Nouvelle alerte
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              Titre *
            </label>
            <Input
              placeholder="Ex: Fuite d'eau urgente"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
          
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              Adresse *
            </label>
            <Input
              placeholder="Ex: 15 Rue de la Paix, Paris"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
          
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onLocationChange={handleLocationChange}
          />
          
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              Description
            </label>
            <Textarea
              placeholder="Détails de l'intervention..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary border-border resize-none"
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">
              Niveau d'urgence
            </label>
            <Select value={urgency} onValueChange={(v) => setUrgency(v as Urgency)}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="high">🔴 Urgent</SelectItem>
                <SelectItem value="medium">🟠 Moyen</SelectItem>
                <SelectItem value="low">🟢 Normal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
