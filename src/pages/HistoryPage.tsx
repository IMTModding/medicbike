import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHistoryInterventions, useInterventionEvents } from '@/hooks/useInterventions';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin,
  Calendar,
  Filter,
  Loader2,
  History,
  Search,
  X,
  Trash2,
  CheckSquare,
  Square,
  Car,
  Target,
  FileText,
  Edit3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ExportHistoryDialog from '@/components/ExportHistoryDialog';
import CompletionNotesDialog from '@/components/CompletionNotesDialog';
import { HistoryPageSkeleton } from '@/components/PageSkeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState<{
    id: string;
    title: string;
    completion_notes: string | null;
  } | null>(null);
  
  const { user, loading: authLoading, isAdmin, isCreator } = useAuth();
  const navigate = useNavigate();

  // React Query with caching
  const { 
    data: interventions = [], 
    isLoading: loading,
    refetch,
  } = useHistoryInterventions(appliedStartDate, appliedEndDate);

  // Get intervention IDs for events query
  const interventionIds = useMemo(() => interventions.map(i => i.id), [interventions]);
  
  // Fetch events for all interventions
  const { data: eventsMap = {} } = useInterventionEvents(interventionIds);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleApplyFilters = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setSearchQuery('');
    setUrgencyFilter('all');
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInterventions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInterventions.map(i => i.id)));
    }
  };

  const cancelSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setDeleting(true);
    try {
      const { data, error } = await supabase
        .from('interventions')
        .delete()
        .in('id', Array.from(selectedIds))
        .select('id');

      if (error) throw error;

      const deletedCount = data?.length ?? 0;
      if (deletedCount === 0) {
        toast.error("Suppression refusée (droits insuffisants)");
        return;
      }

      toast.success(`${deletedCount} intervention(s) supprimée(s)`);
      setSelectedIds(new Set());
      setSelectionMode(false);
      refetch();
    } catch (error) {
      console.error('Error deleting interventions:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Filtered interventions based on search and urgency
  const filteredInterventions = useMemo(() => {
    return interventions.filter(intervention => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        intervention.title.toLowerCase().includes(searchLower) ||
        intervention.location.toLowerCase().includes(searchLower) ||
        (intervention.description?.toLowerCase().includes(searchLower));
      
      // Urgency filter
      const matchesUrgency = urgencyFilter === 'all' || intervention.urgency === urgencyFilter;
      
      return matchesSearch && matchesUrgency;
    });
  }, [interventions, searchQuery, urgencyFilter]);

  const hasActiveFilters = searchQuery || urgencyFilter !== 'all' || appliedStartDate || appliedEndDate;

  const canDelete = useMemo(() => {
    if (!user) return false;
    if (isAdmin || isCreator) return true;
    return filteredInterventions.some((i: any) => i.created_by === user.id);
  }, [filteredInterventions, isAdmin, isCreator, user]);

  const canEditNotes = isAdmin || isCreator;

  const openNotesDialog = (intervention: any) => {
    setSelectedIntervention({
      id: intervention.id,
      title: intervention.title,
      completion_notes: intervention.completion_notes || null,
    });
    setNotesDialogOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Show skeleton while loading data
  if (loading && user && interventions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
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
          </div>
        </header>
        <HistoryPageSkeleton />
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
              onClick={() => selectionMode ? cancelSelectionMode() : navigate('/')}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-accent transition-colors"
            >
              {selectionMode ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
            <div>
              <h1 className="font-bold text-lg text-foreground">
                {selectionMode ? `${selectedIds.size} sélectionnée(s)` : 'Historique'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {selectionMode ? 'Sélectionnez les interventions à supprimer' : 'Interventions terminées'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {selectionMode ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedIds.size === filteredInterventions.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={selectedIds.size === 0}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <>
                <ExportHistoryDialog startDate={appliedStartDate} endDate={appliedEndDate} />
                {canDelete && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => setSelectionMode(true)}
                    title="Supprimer des interventions"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(showFilters && "bg-primary text-primary-foreground")}
                >
                  <Filter className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Supprimer les interventions"
        description={`Êtes-vous sûr de vouloir supprimer ${selectedIds.size} intervention(s) ? Cette action est irréversible.`}
        confirmLabel={deleting ? "Suppression..." : "Supprimer"}
        onConfirm={handleDeleteSelected}
        variant="destructive"
      />

      <main className="container px-4 py-6">
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre, lieu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-secondary border-border"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-card rounded-xl border border-border p-4 mb-6 slide-up">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtres avancés
            </h3>
            
            {/* Urgency Filter */}
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1.5 block">Niveau d'urgence</label>
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Tous les niveaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les niveaux</SelectItem>
                  <SelectItem value="high">Urgent</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="low">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" />
              Période
            </h4>
            
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
                disabled={!hasActiveFilters}
              >
                Effacer tout
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
                <p className="text-2xl font-bold text-foreground">{filteredInterventions.length}</p>
                <p className="text-sm text-muted-foreground">
                  intervention{filteredInterventions.length > 1 ? 's' : ''} 
                  {filteredInterventions.length !== interventions.length && ` (sur ${interventions.length})`}
                </p>
              </div>
            </div>
            {(appliedStartDate || appliedEndDate) && (
              <div className="text-right text-sm text-muted-foreground">
                {appliedStartDate && <p>Du {format(new Date(appliedStartDate), 'dd/MM/yyyy')}</p>}
                {appliedEndDate && <p>Au {format(new Date(appliedEndDate), 'dd/MM/yyyy')}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Interventions List */}
        <div className="space-y-4">
          {filteredInterventions.map(intervention => {
            const urgencyConfig = getUrgencyConfig(intervention.urgency);
            const availableCount = intervention.responses.filter(r => r.status === 'available').length;
            const completedDate = intervention.completed_at 
              ? format(new Date(intervention.completed_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })
              : '';

            return (
              <div 
                key={intervention.id}
                className={cn(
                  "bg-card rounded-xl border border-border p-4 transition-colors",
                  selectionMode && "cursor-pointer",
                  selectionMode && selectedIds.has(intervention.id) && "border-primary bg-primary/5"
                )}
                onClick={() => selectionMode && toggleSelection(intervention.id)}
              >
                {/* Selection checkbox */}
                {selectionMode && (
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(intervention.id);
                      }}
                      className="text-primary"
                    >
                      {selectedIds.has(intervention.id) ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.has(intervention.id) ? 'Sélectionnée' : 'Cliquez pour sélectionner'}
                    </span>
                  </div>
                )}
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

                {/* Completion Notes */}
                {(intervention.completion_notes || canEditNotes) && !selectionMode && (
                  <div className="mt-3 bg-accent/30 rounded-lg p-3 border border-accent">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        Notes de fin d'intervention
                      </h4>
                      {canEditNotes && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openNotesDialog(intervention);
                          }}
                          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          {intervention.completion_notes ? 'Modifier' : 'Ajouter'}
                        </button>
                      )}
                    </div>
                    {intervention.completion_notes ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {intervention.completion_notes}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Aucune note ajoutée
                      </p>
                    )}
                  </div>
                )}

                {/* Departure/Arrival Events */}
                {eventsMap[intervention.id] && eventsMap[intervention.id].length > 0 && (
                  <div className="mt-3 bg-primary/5 rounded-lg p-3 border border-primary/20">
                    <h4 className="text-xs font-medium text-primary mb-2 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5" />
                      Chronologie des déplacements
                    </h4>
                    <div className="space-y-1.5">
                      {eventsMap[intervention.id].map(event => (
                        <div 
                          key={event.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          {event.event_type === 'departure' ? (
                            <Car className="w-3 h-3 text-warning" />
                          ) : (
                            <Target className="w-3 h-3 text-success" />
                          )}
                          <span className={cn(
                            "font-medium",
                            event.event_type === 'departure' ? "text-warning" : "text-success"
                          )}>
                            {event.event_type === 'departure' ? 'Départ' : 'Arrivée'}
                          </span>
                          <span className="text-foreground">
                            {event.profile?.full_name || 'Utilisateur'}
                          </span>
                          <span className="text-muted-foreground ml-auto">
                            {format(new Date(event.created_at), 'HH:mm', { locale: fr })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredInterventions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <History className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">
              {interventions.length === 0 ? 'Aucun historique' : 'Aucun résultat'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {interventions.length === 0
                ? (appliedStartDate || appliedEndDate 
                    ? 'Aucune intervention terminée pour cette période'
                    : 'Aucune intervention terminée pour le moment')
                : 'Aucune intervention ne correspond à vos critères de recherche'}
            </p>
            {hasActiveFilters && (
              <Button variant="secondary" onClick={handleClearFilters}>
                Effacer les filtres
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Completion Notes Dialog */}
      {selectedIntervention && (
        <CompletionNotesDialog
          open={notesDialogOpen}
          onOpenChange={setNotesDialogOpen}
          interventionId={selectedIntervention.id}
          interventionTitle={selectedIntervention.title}
          currentNotes={selectedIntervention.completion_notes}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
};

export default HistoryPage;
