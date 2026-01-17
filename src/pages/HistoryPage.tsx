import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchHistoryInterventions, 
  InterventionWithResponses 
} from '@/services/interventions';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin,
  Calendar,
  Filter,
  Loader2,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const getUrgencyConfig = (urgency: string) => {
  switch (urgency) {
    case 'high':
      return {
        label: 'Urgent',
        className: 'bg-urgent/20 text-urgent border-urgent/30',
      };
    case 'medium':
      return {
        label: 'Moyen',
        className: 'bg-warning/20 text-warning border-warning/30',
      };
    case 'low':
      return {
        label: 'Normal',
        className: 'bg-success/20 text-success border-success/30',
      };
    default:
      return {
        label: 'Normal',
        className: 'bg-muted text-muted-foreground',
      };
  }
};

const HistoryPage = () => {
  const [interventions, setInterventions] = useState<InterventionWithResponses[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      
      const data = await fetchHistoryInterventions(start, end);
      setInterventions(data);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleApplyFilters = () => {
    loadData();
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-lg text-foreground">Historique</h1>
              <p className="text-xs text-muted-foreground">Interventions terminées</p>
            </div>
          </div>
          
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-primary text-primary-foreground")}
          >
            <Filter className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container px-4 py-6">
        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-card rounded-xl border border-border p-4 mb-6 slide-up">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Filtrer par date
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Du</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Au</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClearFilters}
                className="flex-1"
              >
                Effacer
              </Button>
              <Button
                size="sm"
                onClick={handleApplyFilters}
                className="flex-1"
              >
                Appliquer
              </Button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="bg-card rounded-xl p-4 border border-border mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{interventions.length}</p>
                <p className="text-sm text-muted-foreground">intervention{interventions.length > 1 ? 's' : ''} terminée{interventions.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            {(startDate || endDate) && (
              <div className="text-right text-sm text-muted-foreground">
                {startDate && <p>Du {format(new Date(startDate), 'dd/MM/yyyy')}</p>}
                {endDate && <p>Au {format(new Date(endDate), 'dd/MM/yyyy')}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Interventions List */}
        <div className="space-y-4">
          {interventions.map(intervention => {
            const urgencyConfig = getUrgencyConfig(intervention.urgency);
            const availableCount = intervention.responses.filter(r => r.status === 'available').length;
            const completedDate = intervention.completed_at 
              ? format(new Date(intervention.completed_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })
              : '';

            return (
              <div 
                key={intervention.id}
                className="bg-card rounded-xl border border-border p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full border",
                    urgencyConfig.className
                  )}>
                    {urgencyConfig.label}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    <span>Terminée</span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-foreground mb-1">
                  {intervention.title}
                </h3>

                {/* Description */}
                {intervention.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {intervention.description}
                  </p>
                )}

                {/* Location */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="truncate">{intervention.location}</span>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Créée le {format(new Date(intervention.created_at), 'dd/MM/yyyy', { locale: fr })}</span>
                  </div>
                  {completedDate && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-success" />
                      <span>Terminée le {completedDate}</span>
                    </div>
                  )}
                </div>

                {/* Response Summary */}
                <div className="bg-secondary/50 rounded-lg p-3">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-success font-medium">{availableCount} dispo</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {intervention.responses.filter(r => r.status === 'unavailable').length} indispo
                      </span>
                    </div>
                  </div>
                  
                  {intervention.responses.length > 0 && (
                    <div className="space-y-1">
                      {intervention.responses
                        .filter(r => r.status === 'available')
                        .slice(0, 3)
                        .map(response => (
                          <div 
                            key={response.id}
                            className="text-xs text-foreground"
                          >
                            ✓ {response.profile?.full_name || 'Utilisateur'}
                          </div>
                        ))}
                      {intervention.responses.filter(r => r.status === 'available').length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{intervention.responses.filter(r => r.status === 'available').length - 3} autre(s)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {interventions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Aucun historique</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {startDate || endDate 
                ? 'Aucune intervention terminée pour cette période'
                : 'Aucune intervention terminée pour le moment'}
            </p>
            {(startDate || endDate) && (
              <Button variant="secondary" onClick={handleClearFilters}>
                Effacer les filtres
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default HistoryPage;
