import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchInterventionsWithResponses, 
  deleteIntervention,
  completeIntervention,
  subscribeToInterventions,
  subscribeToResponses,
  InterventionWithResponses 
} from '@/services/interventions';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin,
  Trash2,
  Users,
  Loader2,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const getUrgencyConfig = (urgency: string) => {
  switch (urgency) {
    case 'high':
      return {
        label: 'Urgent',
        className: 'bg-urgent/20 text-urgent border-urgent/30',
        dotClass: 'bg-urgent',
      };
    case 'medium':
      return {
        label: 'Moyen',
        className: 'bg-warning/20 text-warning border-warning/30',
        dotClass: 'bg-warning',
      };
    case 'low':
      return {
        label: 'Normal',
        className: 'bg-success/20 text-success border-success/30',
        dotClass: 'bg-success',
      };
    default:
      return {
        label: 'Normal',
        className: 'bg-muted text-muted-foreground',
        dotClass: 'bg-muted-foreground',
      };
  }
};

const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  
  return `Il y a ${Math.floor(diffHours / 24)}j`;
};

const AdminDashboard = () => {
  const [interventions, setInterventions] = useState<InterventionWithResponses[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const data = await fetchInterventionsWithResponses('active');
      setInterventions(data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    // Wait for role to be loaded before enforcing admin-only access
    if (role === null) return;

    if (role !== 'admin') {
      navigate('/');
      toast.error('Accès réservé aux administrateurs');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role === 'admin') {
      loadData();
      
      const intChannel = subscribeToInterventions(() => loadData());
      const respChannel = subscribeToResponses(() => loadData());
      
      return () => {
        intChannel.unsubscribe();
        respChannel.unsubscribe();
      };
    }
  }, [user, role, loadData]);

  const handleComplete = async (id: string) => {
    setActionLoading(id);
    try {
      await completeIntervention(id);
      toast.success('Intervention marquée comme terminée');
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette intervention ?')) return;
    
    setActionLoading(id);
    try {
      await deleteIntervention(id);
      toast.success('Intervention supprimée');
      loadData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user || role !== 'admin') {
    return null;
  }

  // Stats
  const totalResponses = interventions.reduce((acc, i) => acc + i.responses.length, 0);
  const availableResponses = interventions.reduce(
    (acc, i) => acc + i.responses.filter(r => r.status === 'available').length, 
    0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center gap-4 h-16 px-4">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-lg text-foreground">Dashboard Admin</h1>
            <p className="text-xs text-muted-foreground">Gestion des interventions</p>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Actives</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{interventions.length}</p>
          </div>
          
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Réponses</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalResponses}</p>
          </div>
          
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Dispos</span>
            </div>
            <p className="text-2xl font-bold text-success">{availableResponses}</p>
          </div>
        </div>

        {/* Quick Links */}
        <Button
          variant="secondary"
          className="w-full mb-6"
          onClick={() => navigate('/history')}
        >
          <Clock className="w-4 h-4 mr-2" />
          Voir l'historique des interventions
        </Button>

        {/* Interventions List */}
        <div className="space-y-4">
          {interventions.map(intervention => {
            const urgencyConfig = getUrgencyConfig(intervention.urgency);
            const availableCount = intervention.responses.filter(r => r.status === 'available').length;
            const unavailableCount = intervention.responses.filter(r => r.status === 'unavailable').length;
            const isLoading = actionLoading === intervention.id;

            return (
              <div 
                key={intervention.id}
                className="bg-card rounded-xl border border-border p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", urgencyConfig.dotClass)} />
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full border",
                      urgencyConfig.className
                    )}>
                      {urgencyConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2">
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(intervention.created_at)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                      onClick={() => handleComplete(intervention.id)}
                      disabled={isLoading}
                      title="Marquer comme terminée"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(intervention.id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
                  {intervention.urgency === 'high' && (
                    <AlertTriangle className="w-4 h-4 text-urgent" />
                  )}
                  {intervention.title}
                </h3>

                {/* Location */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="truncate">{intervention.location}</span>
                </div>

                {/* Response Summary */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-success font-medium">{availableCount} dispo</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{unavailableCount} indispo</span>
                  </div>
                </div>

                {/* Responses List */}
                {intervention.responses.length > 0 ? (
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                    {intervention.responses.map(response => (
                      <div 
                        key={response.id}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-foreground">
                          {response.profile?.full_name || 'Utilisateur'}
                        </span>
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          response.status === 'available' 
                            ? "bg-success/20 text-success" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {response.status === 'available' ? 'Disponible' : 'Indisponible'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Aucune réponse pour le moment
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {interventions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Aucune intervention active</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre première alerte depuis la page principale
            </p>
            <Button onClick={() => navigate('/')}>
              Retour à l'accueil
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
