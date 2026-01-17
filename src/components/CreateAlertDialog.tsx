import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertTriangle } from 'lucide-react';
import { createIntervention, Urgency } from '@/services/interventions';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface CreateAlertDialogProps {
  onCreated: () => void;
}

export const CreateAlertDialog = ({ onCreated }: CreateAlertDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  
  const { user } = useAuth();

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
      });
      
      toast.success('Alerte créée avec succès !');
      setOpen(false);
      resetForm();
      onCreated();
    } catch (error) {
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
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-xl">
          <Plus className="w-6 h-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md mx-4">
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
