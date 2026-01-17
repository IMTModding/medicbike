import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { AlertCard } from '@/components/AlertCard';
import { CreateAlertDialog } from '@/components/CreateAlertDialog';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchInterventions, 
  respondToIntervention, 
  subscribeToInterventions,
  Intervention 
} from '@/services/interventions';
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user, loading: authLoading, role } = useAuth();
  const navigate = useNavigate();

  const loadInterventions = useCallback(async () => {
    if (!user) return;
    
    try {
      const data = await fetchInterventions(user.id);
      setInterventions(data);
    } catch (error) {
      console.error('Error loading interventions:', error);
      toast.error('Erreur lors du chargement des alertes');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadInterventions();
      
      // Subscribe to realtime updates
      const channel = subscribeToInterventions(() => {
        loadInterventions();
      });
      
      return () => {
        channel.unsubscribe();
      };
    }
  }, [user, loadInterventions]);

  const handleStatusChange = async (id: string, status: 'available' | 'unavailable') => {
    if (!user) return;
    
    try {
      await respondToIntervention(id, user.id, status);
      
      // Update local state
      setInterventions(prev =>
        prev.map(intervention =>
          intervention.id === id ? { ...intervention, userStatus: status } : intervention
        )
      );
      
      toast.success(status === 'available' 
        ? 'Vous êtes maintenant disponible' 
        : 'Réponse enregistrée'
      );
    } catch (error) {
      console.error('Error responding to intervention:', error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const pendingCount = interventions.filter(i => i.userStatus === 'pending').length;
  const availableCount = interventions.filter(i => i.userStatus === 'available').length;
  const urgentCount = interventions.filter(i => i.urgency === 'high' && i.userStatus === 'pending').length;

  const sortedInterventions = [...interventions].sort((a, b) => {
    // Sort by urgency first, then by date
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container px-4 py-6 pb-24">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">En attente</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
          </div>
          
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-urgent" />
              <span className="text-xs text-muted-foreground">Urgentes</span>
            </div>
            <p className="text-2xl font-bold text-urgent">{urgentCount}</p>
          </div>
          
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-xs text-muted-foreground">Acceptées</span>
            </div>
            <p className="text-2xl font-bold text-success">{availableCount}</p>
          </div>
        </div>

        {/* Section Title */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Alertes récentes</h2>
          <span className="text-sm text-muted-foreground">
            {interventions.length} intervention{interventions.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {sortedInterventions.map(intervention => (
            <AlertCard
              key={intervention.id}
              intervention={intervention}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>

        {/* Empty State */}
        {interventions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Aucune alerte</h3>
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas d'interventions en cours
            </p>
          </div>
        )}
      </main>

      {/* Admin: Create Alert Button */}
      {role === 'admin' && (
        <CreateAlertDialog onCreated={loadInterventions} />
      )}
    </div>
  );
};

export default Index;
