import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Bike, Trash2, Edit2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Vehicle {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export const VehicleManager = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleName, setVehicleName] = useState('');
  const [saving, setSaving] = useState(false);
  
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    if (user) {
      fetchVehicles();
    }
  }, [user]);

  const fetchVehicles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Erreur lors du chargement des motos');
    } else {
      setVehicles(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleName.trim() || !user) return;

    setSaving(true);

    try {
      if (editingVehicle) {
        // Update existing vehicle
        const { error } = await supabase
          .from('vehicles')
          .update({ name: vehicleName.trim() })
          .eq('id', editingVehicle.id);

        if (error) throw error;
        toast.success('Moto modifiée');
      } else {
        // Get user's organization
        const { data: orgInfo } = await supabase
          .rpc('get_user_organization_info', { user_id_param: user.id });

        const organizationId = orgInfo?.[0]?.user_invite_code_id || null;

        // Create new vehicle
        const { error } = await supabase
          .from('vehicles')
          .insert({
            name: vehicleName.trim(),
            admin_id: user.id,
            organization_id: organizationId,
          });

        if (error) throw error;
        toast.success('Moto ajoutée');
      }

      setDialogOpen(false);
      setVehicleName('');
      setEditingVehicle(null);
      fetchVehicles();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleName(vehicle.name);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette moto ?')) return;

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting vehicle:', error);
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success('Moto supprimée');
      fetchVehicles();
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setVehicleName('');
      setEditingVehicle(null);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Bike className="w-5 h-5" />
          Gestion des motos
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingVehicle ? 'Modifier la moto' : 'Ajouter une moto'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Nom de la moto
                </label>
                <Input
                  placeholder="Ex: Moto 1"
                  value={vehicleName}
                  onChange={(e) => setVehicleName(e.target.value)}
                  className="bg-secondary border-border"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={saving}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={saving || !vehicleName.trim()}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingVehicle ? (
                    'Modifier'
                  ) : (
                    'Ajouter'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : vehicles.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Aucune moto configurée
          </p>
        ) : (
          <div className="space-y-2">
            {vehicles.map(vehicle => (
              <div
                key={vehicle.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg",
                  "bg-secondary/50 border border-border",
                  "hover:bg-secondary/80 transition-colors"
                )}
              >
                <div className="flex items-center gap-3">
                  <Bike className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">{vehicle.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(vehicle)}
                    className="h-8 w-8 p-0 hover:bg-primary/20"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(vehicle.id)}
                    className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
