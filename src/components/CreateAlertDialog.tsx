import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, AlertTriangle, MapPin, FileText, Loader2, CheckCircle2, Sparkles, Navigation, Bike, User, Trash2 } from 'lucide-react';
import { createIntervention, Urgency } from '@/services/interventions';
import { sendPushNotification } from '@/services/pushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CreateAlertDialogProps {
  onCreated: () => void;
}

interface Vehicle {
  id: string;
  name: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
}

interface Assignment {
  id: string;
  userId: string;
  vehicleId: string;
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
  
  // New state for assignments
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  
  const { user } = useAuth();

  const fullAddress = [numero, rue, codePostal, ville].filter(Boolean).join(' ').trim();

  // Fetch vehicles and employees when dialog opens
  useEffect(() => {
    if (open && user) {
      fetchVehiclesAndEmployees();
    }
  }, [open, user]);

  const fetchVehiclesAndEmployees = async () => {
    if (!user) return;

    // Fetch vehicles
    const { data: vehiclesData } = await supabase
      .from('vehicles')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (vehiclesData) {
      setVehicles(vehiclesData);
    }

    // Fetch employees from organization
    const { data: profilesData } = await supabase
      .rpc('get_organization_profiles', { p_user_id: user.id });
    
    if (profilesData) {
      setEmployees(profilesData.filter((p: Profile) => p.user_id !== user.id));
    }
  };

  const addAssignment = () => {
    if (!selectedEmployee || !selectedVehicle) {
      toast.error('Sélectionnez un employé et une moto');
      return;
    }

    // Check if this employee already has an assignment
    if (assignments.some(a => a.userId === selectedEmployee)) {
      toast.error('Cet employé a déjà une affectation');
      return;
    }

    // Check if this vehicle is already assigned
    if (assignments.some(a => a.vehicleId === selectedVehicle)) {
      toast.error('Cette moto est déjà affectée');
      return;
    }

    setAssignments([
      ...assignments,
      {
        id: crypto.randomUUID(),
        userId: selectedEmployee,
        vehicleId: selectedVehicle,
      }
    ]);

    setSelectedEmployee('');
    setSelectedVehicle('');
  };

  const removeAssignment = (id: string) => {
    setAssignments(assignments.filter(a => a.id !== id));
  };

  const getEmployeeName = (userId: string) => {
    return employees.find(e => e.user_id === userId)?.full_name || 'Inconnu';
  };

  const getVehicleName = (vehicleId: string) => {
    return vehicles.find(v => v.id === vehicleId)?.name || 'Inconnu';
  };

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
      // Create intervention
      const { data: interventionData, error: interventionError } = await supabase
        .from('interventions')
        .insert({
          title: title.trim(),
          location: fullAddress,
          description: description.trim() || null,
          urgency,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (interventionError) throw interventionError;

      // Create assignments if any
      if (assignments.length > 0 && interventionData) {
        const assignmentsToInsert = assignments.map(a => ({
          intervention_id: interventionData.id,
          user_id: a.userId,
          vehicle_id: a.vehicleId,
        }));

        const { error: assignmentError } = await supabase
          .from('intervention_assignments')
          .insert(assignmentsToInsert);

        if (assignmentError) {
          console.error('Error creating assignments:', assignmentError);
        }
      }
      
      // Build notification message with assignments
      let notifBody = `📍 ${fullAddress}`;
      if (assignments.length > 0) {
        const assignmentsList = assignments
          .map(a => `${getEmployeeName(a.userId)} → ${getVehicleName(a.vehicleId)}`)
          .join(', ');
        notifBody += `\n🏍️ ${assignmentsList}`;
      }

      // Send push notification to all employees
      const notifTitle = `🚨 URGENT: ${title.trim()}`;
      
      await sendPushNotification(
        notifTitle,
        notifBody,
        urgency,
        interventionData?.id || crypto.randomUUID()
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
    setAssignments([]);
    setSelectedEmployee('');
    setSelectedVehicle('');
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

  // Filter out already assigned employees and vehicles
  const availableEmployees = employees.filter(
    e => !assignments.some(a => a.userId === e.user_id)
  );
  const availableVehicles = vehicles.filter(
    v => !assignments.some(a => a.vehicleId === v.id)
  );

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

              {/* Vehicle Assignments Section */}
              <div className="space-y-3">
                <label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Bike className="w-3.5 h-3.5" />
                  Affectation motos (optionnel)
                </label>

                {/* Current assignments */}
                {assignments.length > 0 && (
                  <div className="space-y-2">
                    {assignments.map(assignment => (
                      <div 
                        key={assignment.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-primary" />
                          <span className="font-medium">{getEmployeeName(assignment.userId)}</span>
                          <span className="text-muted-foreground">→</span>
                          <Bike className="w-4 h-4 text-primary" />
                          <span>{getVehicleName(assignment.vehicleId)}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAssignment(assignment.id)}
                          className="h-7 w-7 p-0 hover:bg-destructive/20 hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new assignment */}
                {availableEmployees.length > 0 && availableVehicles.length > 0 && (
                  <div className="flex gap-2">
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="flex-1 bg-secondary border-border">
                        <SelectValue placeholder="Employé" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEmployees.map(employee => (
                          <SelectItem key={employee.user_id} value={employee.user_id}>
                            {employee.full_name || 'Sans nom'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                      <SelectTrigger className="flex-1 bg-secondary border-border">
                        <SelectValue placeholder="Moto" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVehicles.map(vehicle => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addAssignment}
                      disabled={!selectedEmployee || !selectedVehicle}
                      className="shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {vehicles.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Aucune moto configurée. Ajoutez des motos dans les paramètres.
                  </p>
                )}
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
