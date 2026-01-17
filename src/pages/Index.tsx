import { useState } from 'react';
import { Header } from '@/components/Header';
import { AlertCard } from '@/components/AlertCard';
import { mockInterventions, Intervention } from '@/data/interventions';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const Index = () => {
  const [interventions, setInterventions] = useState<Intervention[]>(
    mockInterventions.map(i => ({ ...i, status: 'pending' as const }))
  );

  const handleStatusChange = (id: string, status: 'available' | 'unavailable') => {
    setInterventions(prev =>
      prev.map(intervention =>
        intervention.id === id ? { ...intervention, status } : intervention
      )
    );
  };

  const pendingCount = interventions.filter(i => i.status === 'pending').length;
  const availableCount = interventions.filter(i => i.status === 'available').length;
  const urgentCount = interventions.filter(i => i.urgency === 'high' && i.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container px-4 py-6">
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
          {interventions
            .sort((a, b) => {
              // Sort by urgency first, then by date
              const urgencyOrder = { high: 0, medium: 1, low: 2 };
              if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
              }
              return b.createdAt.getTime() - a.createdAt.getTime();
            })
            .map(intervention => (
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
    </div>
  );
};

export default Index;
