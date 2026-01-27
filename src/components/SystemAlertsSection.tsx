import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Trash2, RefreshCw, Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

type SystemAlert = {
  id: string;
  user_id: string;
  message: string;
  status: string;
  created_at: string;
};

export function SystemAlertsSection() {
  const { isAdmin, isCreator } = useAuth();
  const canManage = isAdmin || isCreator;

  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteTarget = useMemo(
    () => (deleteId ? alerts.find((a) => a.id === deleteId) : undefined),
    [alerts, deleteId]
  );

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select('id, user_id, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching alerts:', error);
      toast.error("Impossible de charger les alertes");
      return;
    }

    setAlerts((data || []) as SystemAlert[]);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!mounted) return;
        setLoading(true);
        await fetchAlerts();
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAlerts();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('alerts').delete().eq('id', deleteId);
      if (error) {
        console.error('Error deleting alert:', error);
        toast.error("Suppression refusée");
        return;
      }
      setAlerts((prev) => prev.filter((a) => a.id !== deleteId));
      toast.success('Alerte supprimée');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <span>Alertes système</span>
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="gap-2"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualiser
        </Button>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune alerte système pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card/50 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground break-words">{a.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(parseISO(a.created_at), { addSuffix: true, locale: fr })}
                    {' · '}
                    {a.status}
                  </p>
                </div>

                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(a.id)}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Supprimer l'alerte"
        description={
          deleteTarget
            ? `Supprimer définitivement l'alerte “${deleteTarget.message}” ?`
            : "Supprimer définitivement cette alerte ?"
        }
        confirmLabel={deleting ? 'Suppression...' : 'Supprimer'}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </Card>
  );
}
