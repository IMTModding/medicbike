import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { AlertCard } from '@/components/AlertCard';
import { CreateAlertDialog } from '@/components/CreateAlertDialog';
import Onboarding from '@/components/Onboarding';
import { IndexPageSkeleton } from '@/components/PageSkeleton';
import OfflineBanner from '@/components/OfflineBanner';
import { AvailabilityCalendar } from '@/components/AvailabilityCalendar';

import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { 
  useActiveInterventions, 
  useLatestNews,
  useRespondToIntervention,
  useCompleteIntervention,
} from '@/hooks/useInterventions';
import { Intervention } from '@/services/interventions';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle2, Clock, Loader2, ChevronRight, Newspaper } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { showOnboarding, completeOnboarding } = useOnboarding();
  const { isOnline, cacheInterventions, getCacheTimestamp, cachedInterventions } = useOfflineMode();

  // React Query hooks for cached data
  const { 
    data: interventions = [], 
    isLoading: loadingInterventions,
    refetch: refetchInterventions,
  } = useActiveInterventions(user?.id);

  const { 
    data: latestNews = [], 
    isLoading: loadingNews,
  } = useLatestNews();

  const respondMutation = useRespondToIntervention();
  const completeMutation = useCompleteIntervention();

  // Cache interventions for offline use when data changes
  useEffect(() => {
    if (interventions.length > 0 && isOnline) {
      cacheInterventions(interventions.map(i => ({
        id: i.id,
        title: i.title,
        location: i.location,
        status: i.status,
        urgency: i.urgency,
        created_at: i.created_at,
        description: i.description || undefined
      })));
    }
  }, [interventions, isOnline, cacheInterventions]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleStatusChange = async (id: string, status: 'available' | 'unavailable') => {
    if (!user) return;
    
    try {
      await respondMutation.mutateAsync({ interventionId: id, userId: user.id, status });
      toast.success(status === 'available' 
        ? 'Vous êtes maintenant disponible' 
        : 'Réponse enregistrée'
      );
    } catch (error) {
      console.error('Error responding to intervention:', error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleCompleteIntervention = async (id: string) => {
    try {
      await completeMutation.mutateAsync(id);
      toast.success('Intervention terminée');
    } catch (error) {
      console.error('Error completing intervention:', error);
      toast.error('Erreur lors de la clôture');
    }
  };

  // Use cached data when offline
  const displayedInterventions = isOnline ? interventions : (cachedInterventions as Intervention[]);
  const loading = loadingInterventions && interventions.length === 0;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Show skeleton while loading data (after auth is ready)
  if (loading && user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <IndexPageSkeleton />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const pendingCount = displayedInterventions.filter(i => i.userStatus === 'pending').length;
  const availableCount = displayedInterventions.filter(i => i.userStatus === 'available').length;
  const urgentCount = displayedInterventions.filter(i => i.urgency === 'high' && i.userStatus === 'pending').length;

  const sortedInterventions = [...displayedInterventions].sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Onboarding */}
      <Onboarding open={showOnboarding} onComplete={completeOnboarding} />
      
      <main className="container px-4 py-6 pb-24">
        {/* Offline Banner */}
        {!isOnline && (
          <OfflineBanner 
            cacheTimestamp={getCacheTimestamp()} 
            onRefresh={() => window.location.reload()} 
          />
        )}
        {/* News Banner */}
        {latestNews.length > 0 && (
          <div 
            onClick={() => navigate('/news')}
            className="mb-6 bg-card rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3 p-3 bg-primary/10">
              <Newspaper className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-foreground">Actualités</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </div>
            <div className="flex overflow-x-auto gap-3 p-3 scrollbar-hide">
              {latestNews.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-32">
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.title}
                      className="w-32 h-20 object-cover rounded-lg mb-2"
                    />
                  ) : (
                    <div className="w-32 h-20 bg-muted rounded-lg mb-2 flex items-center justify-center">
                      <Newspaper className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs text-foreground line-clamp-2 font-medium">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Availability Calendar */}
        <AvailabilityCalendar />

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
            {displayedInterventions.length} intervention{displayedInterventions.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {sortedInterventions.map(intervention => (
            <AlertCard
              key={intervention.id}
              intervention={intervention}
              onStatusChange={handleStatusChange}
              onComplete={handleCompleteIntervention}
            />
          ))}
        </div>

        {/* Empty State */}
        {displayedInterventions.length === 0 && (
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
      {isAdmin && (
        <CreateAlertDialog onCreated={refetchInterventions} />
      )}
    </div>
  );
};

export default Index;
